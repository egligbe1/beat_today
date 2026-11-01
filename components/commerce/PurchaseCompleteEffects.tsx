'use client'
import {useEffect} from 'react'
import {useCartStore} from '@/lib/stores/cartStore'
import {invalidateOwnedLicenses} from '@/lib/hooks/useOwnedLicenses'
export default function PurchaseCompleteEffects({items}:{items:{beat_id:string;license_type:string}[]}){
 useEffect(()=>{const state=useCartStore.getState();for(const item of items)if(state.items.some(current=>current.beat_id===item.beat_id&&current.license_type===item.license_type))state.removeItem(item.beat_id);invalidateOwnedLicenses()},[items])
 return null
}
