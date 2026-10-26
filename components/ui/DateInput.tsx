'use client'
import type { InputHTMLAttributes } from 'react'

export default function DateInput({className='',onClick,onKeyDown,...props}:Omit<InputHTMLAttributes<HTMLInputElement>,'type'>) {
 function open(input:HTMLInputElement) {
  if(input.disabled||input.readOnly)return
  // Native pickers need a direct user gesture; browsers without showPicker keep
  // their normal editable date input and calendar icon.
  try { input.showPicker?.() } catch {}
 }
 return <input {...props} type="date" className={`cursor-pointer [color-scheme:dark] ${className}`}
  onClick={event=>{onClick?.(event);if(!event.defaultPrevented)open(event.currentTarget)}}
  onKeyDown={event=>{onKeyDown?.(event);if(!event.defaultPrevented&&(event.key==='Enter'||event.key===' ')){event.preventDefault();open(event.currentTarget)}}}/>
}
