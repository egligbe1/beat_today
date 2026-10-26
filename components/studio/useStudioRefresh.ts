'use client'
import {useRouter} from 'next/navigation'
import {useLiveRefresh,type LiveScope} from '@/lib/hooks/useLiveRefresh'

export function useStudioRefresh(enabled=true,scopes:LiveScope[]=[]) {
 const router=useRouter()
 useLiveRefresh(()=>router.refresh(),scopes,enabled,10000)
}
