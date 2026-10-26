'use client'
import {useRouter} from 'next/navigation'
import {useLiveRefresh} from '@/lib/hooks/useLiveRefresh'
export default function InboxLiveUpdates({userId}:{userId:string}) {
 const router=useRouter()
 useLiveRefresh(()=>router.refresh(),[
  {table:'conversations',filter:`participant_1=eq.${userId}`},
  {table:'conversations',filter:`participant_2=eq.${userId}`},
 ],true,10000)
 return null
}
