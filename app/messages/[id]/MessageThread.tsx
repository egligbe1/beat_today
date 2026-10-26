'use client'
import {useState,useEffect,useRef} from 'react'
import {Send,Loader2,ArrowDown} from 'lucide-react'
import Image from 'next/image'
import type {ChatMessage as Message} from '@/lib/types'
import {mergeMessages,messageCursor} from '@/lib/messages'
import {useLiveRefresh} from '@/lib/hooks/useLiveRefresh'

interface Props {
 conversationId:string;currentUserId:string;initialMessages:Message[]
 otherUser:{id:string;display_name:string;avatar_url:string|null}
}
export default function MessageThread({conversationId,currentUserId,initialMessages,otherUser}:Props) {
 const [messages,setMessages]=useState<Message[]>(initialMessages)
 const messagesRef=useRef(initialMessages)
 const active=useRef(true),syncing=useRef(false)
 useEffect(()=>{active.current=true;return()=>{active.current=false}},[])
 const cursor=useRef(messageCursor(initialMessages.at(-1)))
 const [input,setInput]=useState(''),[sending,setSending]=useState(false),[error,setError]=useState(''),[syncError,setSyncError]=useState('')
 const [unseen,setUnseen]=useState(0)
 const scrollRef=useRef<HTMLDivElement>(null),bottomRef=useRef<HTMLDivElement>(null)
 const follow=useRef(true),readPending=useRef(new Set<string>())
 function receive(incoming:Message[]){
  if(!active.current)return
  const known=new Set(messagesRef.current.map(message=>message.id))
  const added=incoming.filter(message=>!known.has(message.id)&&message.sender_id!==currentUserId).length
  const merged=mergeMessages(messagesRef.current,incoming)
  messagesRef.current=merged;setMessages(merged)
  if(added&&!follow.current)setUnseen(n=>n+added)
 }
 useEffect(()=>{receive(initialMessages)},[initialMessages])
 useEffect(()=>{if(follow.current){bottomRef.current?.scrollIntoView({behavior:'auto',block:'nearest'});setUnseen(0)}},[messages])
 async function markRead(){
  if(!active.current||!follow.current||document.visibilityState!=='visible')return
  const ids=messagesRef.current.filter(message=>message.sender_id!==currentUserId&&!message.is_read&&!readPending.current.has(message.id)).slice(-100).map(message=>message.id)
  if(!ids.length)return
  ids.forEach(id=>readPending.current.add(id))
  try{
   const response=await fetch('/api/messages',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({conversation_id:conversationId,ids})})
   if(!response.ok)throw new Error('Unread state could not be updated')
   receive(messagesRef.current.filter(message=>ids.includes(message.id)).map(message=>({...message,is_read:true})))
   window.dispatchEvent(new Event('beattoday:notifications-refresh'))
  }catch{ids.forEach(id=>readPending.current.delete(id))}
 }
 async function sync(){
  if(syncing.current||!active.current)return
  syncing.current=true
  try{
   // Cursor advances only after catch-up reads, never after a local send or
   // socket event: either could arrive ahead of a previously missed message.
   for(let page=0;page<5;page++){
    const params=new URLSearchParams({conversation_id:conversationId})
    if(cursor.current){params.set('after',cursor.current.created_at);params.set('after_id',cursor.current.id)}
    const response=await fetch('/api/messages?'+params,{cache:'no-store'})
    const result=await response.json()
    if(!response.ok)throw new Error(result.error||'Messages could not be refreshed')
    if(!Array.isArray(result.messages))throw new Error('Messages could not be refreshed')
    if(!active.current)return
    const incoming=result.messages as Message[]
    receive(incoming)
    if(incoming.length)cursor.current=messageCursor(incoming.at(-1))
    if(!result.has_more||!incoming.length)break
   }
   setSyncError('');await markRead()
  }catch{if(active.current)setSyncError('Messages could not be refreshed. Reconnecting automatically…')}
  finally{syncing.current=false}
 }
 useLiveRefresh(sync,[{table:'messages',filter:`conversation_id=eq.${conversationId}`}])
 async function handleSend(event:React.FormEvent){
  event.preventDefault();if(!input.trim()||sending)return
  const content=input.trim();setSending(true);setError('')
  try{
   const response=await fetch('/api/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({conversation_id:conversationId,content})})
   const result=await response.json()
   if(!response.ok||!result.message?.id)throw new Error(result.error||'Message could not be sent')
   follow.current=true;receive([result.message]);setInput('');void sync()
  }catch(error){setError(error instanceof Error?error.message:'Message could not be sent. Your draft is still here; please try again.')}
  finally{setSending(false)}
 }
  function groupByDate(msgs: Message[]) {
    const groups: { date: string; messages: Message[] }[] = []
    msgs.forEach(msg => {
      const date = new Date(msg.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
      const last = groups[groups.length - 1]
      if (last?.date === date) {
        last.messages.push(msg)
      } else {
        groups.push({ date, messages: [msg] })
      }
    })
    return groups
  }

  const groups = groupByDate(messages)

  return (
    <div className="flex flex-col flex-1 max-w-3xl mx-auto w-full px-4">
      {/* Messages */}
      <div ref={scrollRef} role="log" aria-label="Conversation messages" aria-live="polite" aria-relevant="additions" onScroll={()=>{const el=scrollRef.current;if(el){follow.current=el.scrollHeight-el.scrollTop-el.clientHeight<100;if(follow.current)setUnseen(0)}}} className="flex-1 py-6 space-y-6 overflow-y-auto min-h-[45vh] max-h-[65dvh]">
        {messages.length === 0 && (
          <div className="text-center py-16 text-text-muted text-sm">
            No messages yet. Say hello!
          </div>
        )}

        {groups.map(group => (
          <div key={group.date} className="space-y-3">
            <div className="text-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted bg-bg-surface px-3 py-1 rounded-full border border-border-subtle">
                {group.date}
              </span>
            </div>
            {group.messages.map(msg => {
              const isMine = msg.sender_id === currentUserId
              return (
                <div key={msg.id} className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                  {!isMine && (
                    <div className="relative w-8 h-8 rounded-full overflow-hidden bg-bg-elevated flex-shrink-0">
                      {otherUser.avatar_url ? (
                        <Image src={otherUser.avatar_url} alt={otherUser.display_name} fill className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-text-muted">
                          {otherUser.display_name?.[0]}
                        </div>
                      )}
                    </div>
                  )}
                  <div
                    className={`max-w-[70%] px-4 py-3 rounded-2xl text-sm ${
                      isMine
                        ? 'bg-accent-orange text-white rounded-br-sm'
                        : 'bg-bg-surface border border-border-subtle text-white rounded-bl-sm'
                    }`}
                  >
                    <p className="leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{msg.content}</p>
                    <p className={`text-[10px] mt-1 ${isMine ? 'text-white/60 text-right' : 'text-text-muted'}`}>
                      {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {unseen>0&&<button type="button" onClick={()=>{follow.current=true;bottomRef.current?.scrollIntoView({behavior:'smooth',block:'nearest'});setUnseen(0)}} className="self-center rounded-full border border-border-subtle bg-bg-surface px-4 py-2 text-sm text-accent-orange inline-flex items-center gap-2"><ArrowDown className="w-4 h-4"/>{unseen} new {unseen===1?'message':'messages'}</button>}
      {syncError&&<p role="status" className="text-xs text-text-muted mt-2">{syncError}</p>}
      {error&&<p role="alert" className="text-sm text-red-300 mt-2">{error}</p>}
      {/* Input */}
      <form onSubmit={handleSend} className="sticky bottom-0 pb-6 pt-3 bg-bg-primary">
        <div className="flex gap-3 items-center bg-bg-surface border border-border-subtle rounded-2xl px-4 py-3 focus-within:border-accent-orange transition-colors">
          <input
            aria-label="Message"
            maxLength={5000}
            disabled={sending}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
          />
          <button
            aria-label="Send message"
            type="submit"
            disabled={!input.trim() || sending}
            className="w-9 h-9 bg-accent-orange rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:bg-[#ff6a1f] transition-colors active:scale-95"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            ) : (
              <Send className="w-4 h-4 text-white" />
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
