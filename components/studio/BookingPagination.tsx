import Link from 'next/link'
import {BOOKING_PAGE_SIZE} from '@/lib/studio/calendar'
export default function BookingPagination({page,total,href,label='Bookings'}:{page:number;total:number;href:(page:number)=>string;label?:string}) {
 const pages=Math.max(1,Math.ceil(total/BOOKING_PAGE_SIZE))
 return <nav aria-label={`${label} pages`} className="flex flex-wrap justify-between items-center gap-3 text-xs text-zinc-400 mt-5">
  <p>{total?`${(page-1)*BOOKING_PAGE_SIZE+1}–${Math.min(page*BOOKING_PAGE_SIZE,total)} of ${total}`:'No bookings'} · Page {page} of {pages}</p>
  <div className="flex gap-4">{page>1&&<Link className="text-orange-400 font-bold" href={href(page-1)} scroll={false}>Previous</Link>}{page<pages&&<Link className="text-orange-400 font-bold" href={href(page+1)} scroll={false}>Next</Link>}</div>
 </nav>
}
