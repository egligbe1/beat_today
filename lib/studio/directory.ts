export const DIRECTORY_SERVICES=['RECORDING','MIXING','MASTERING','PRODUCTION'] as const
export type StudioDirectoryItem={id:string;studio_name:string;city:string;timezone:string;handle:string;display_name:string|null;avatar_url:string|null;country:string;from_minor:number;services:{title:string;type:string;duration_minutes:number;price_minor:number}[]}
export type StudioDirectory={items:StudioDirectoryItem[];total:number;page:number;page_size:number}
export function directoryFilters(input:{q?:unknown;city?:unknown;service?:unknown;page?:unknown}){
 const clean=(value:unknown)=>typeof value==='string'?value.trim().slice(0,80):''
 const service=clean(input.service).toUpperCase()
 const page=typeof input.page==='string'&&/^\d{1,5}$/.test(input.page)?Math.max(1,Math.min(10000,Number(input.page))):1
 return {q:clean(input.q),city:clean(input.city),service:DIRECTORY_SERVICES.includes(service as typeof DIRECTORY_SERVICES[number])?service:'',page}
}
export function directoryUrl(filters:ReturnType<typeof directoryFilters>,page=filters.page){
 const params=new URLSearchParams();if(filters.q)params.set('q',filters.q);if(filters.city)params.set('city',filters.city);if(filters.service)params.set('service',filters.service);if(page>1)params.set('page',String(page))
 return '/producers'+(params.size?'?'+params:'')
}
export function collectiveDestination(signedIn:boolean,role?:string|null){return !signedIn?'/signup?role=producer&redirect=%2Fdashboard%2Fstudio':role==='producer'?'/dashboard/studio':role==='artist'?'/producers':'/complete-profile'}
