// --plan is offline. --export is a separately authorized read/export operation;
// never run it as part of tests, deployment, an audit or routine feature work.
import {spawn} from 'node:child_process'
import {createHash} from 'node:crypto'
import {mkdir,writeFile} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {Readable} from 'node:stream'
import {S3Client,ListObjectsV2Command,GetObjectCommand} from '@aws-sdk/client-s3'
import {encryptBackup} from '../lib/backups/archive.mjs'
const required=['BACKUP_DATABASE_URL','BACKUP_PUBLIC_KEY','CLOUDFLARE_S3_API_ENDPOINT','CLOUDFLARE_R2_ACCESS_KEY_ID','CLOUDFLARE_R2_SECRET_ACCESS_KEY','CLOUDFLARE_S3_PRIVATE_BUCKET','CLOUDFLARE_S3_PUBLIC_BUCKET']
if(!process.argv.includes('--export')){
 console.log(JSON.stringify({mode:'offline-plan',operation:'Read a consistent database dump and copy both asset buckets into new encrypted local backup files. No remote records or objects are changed.',authorization:'Specific export approval required before --export',required_configuration:required,private_key:'Must be kept independently; export uses only the RSA public key.',restore:'No automatic database restore. Validate in a separately approved isolated environment.',destination:'.local-backups/<UTC timestamp> or BACKUP_DIRECTORY',missing_configuration:required.filter(key=>!process.env[key])},null,2))
}else{
 if(process.env.BACKUP_EXPORT_AUTHORIZED!=='yes')throw new Error('This export needs specific authorization; set BACKUP_EXPORT_AUTHORIZED=yes only after approval')
 for(const name of required)if(!process.env[name])throw new Error('Missing backup configuration: '+name)
 const connection=new URL(process.env.BACKUP_DATABASE_URL)
 if(!['postgres:','postgresql:'].includes(connection.protocol))throw new Error('Expected a dedicated Postgres backup connection')
 const date=new Date().toISOString().replace(/[:.]/g,'-'),directory=resolve(process.env.BACKUP_DIRECTORY||'.local-backups',date)
 await mkdir(directory,{recursive:false,mode:0o700})
 const publicKey=process.env.BACKUP_PUBLIC_KEY.replace(/\\n/g,'\n'),manifest={version:1,created_at:new Date().toISOString(),database:'database.btbackup',assets:[]}
 const pg=spawn(process.env.PG_DUMP_BIN||'pg_dump',['--format=custom','--no-password','--host='+connection.hostname,'--port='+(connection.port||'5432'),'--username='+decodeURIComponent(connection.username),'--dbname='+decodeURIComponent(connection.pathname.slice(1))],{env:{PATH:process.env.PATH,PGPASSWORD:decodeURIComponent(connection.password),PGSSLMODE:'verify-full',PGSSLROOTCERT:process.env.PGSSLROOTCERT||'system'},stdio:['ignore','pipe','pipe']})
 pg.stderr.resume()
 const exit=new Promise((resolve,reject)=>{pg.once('error',reject);pg.once('close',code=>code===0?resolve():reject(new Error('Database export failed; check configuration privately')))})
 exit.catch(()=>{})
 // Surface dump failure through the stream before encryption marks this file complete.
 const dump=Readable.from((async function*(){for await(const chunk of pg.stdout)yield chunk;await exit})())
 await encryptBackup(dump,join(directory,manifest.database),publicKey)
 const s3=new S3Client({region:'auto',endpoint:process.env.CLOUDFLARE_S3_API_ENDPOINT,credentials:{accessKeyId:process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,secretAccessKey:process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY}})
 for(const bucket of [process.env.CLOUDFLARE_S3_PRIVATE_BUCKET,process.env.CLOUDFLARE_S3_PUBLIC_BUCKET]){
  let token
  do{
   const page=await s3.send(new ListObjectsV2Command({Bucket:bucket,ContinuationToken:token}),{abortSignal:AbortSignal.timeout(30000)})
   for(const object of page.Contents||[]){
    if(!object.Key||!object.ETag)throw new Error('Asset inventory incomplete')
    const filename=createHash('sha256').update(bucket+'\0'+object.Key).digest('hex')+'.btbackup'
    const source=await s3.send(new GetObjectCommand({Bucket:bucket,Key:object.Key,IfMatch:object.ETag}),{abortSignal:AbortSignal.timeout(300000)})
    const checksum=createHash('sha256');let bytes=0
    const stream=Readable.from((async function*(){for await(const chunk of source.Body){bytes+=chunk.length;checksum.update(chunk);yield chunk}if(bytes!==object.Size)throw new Error('Asset size changed during export')})())
    await encryptBackup(stream,join(directory,filename),publicKey)
    manifest.assets.push({bucket,key:object.Key,etag:object.ETag,size:bytes,sha256:checksum.digest('hex'),file:filename})
   }
   token=page.IsTruncated?page.NextContinuationToken:undefined
   if(page.IsTruncated&&!token)throw new Error('Asset inventory pagination incomplete')
  }while(token)
 }
 await encryptBackup(Readable.from([Buffer.from(JSON.stringify(manifest))]),join(directory,'manifest.btbackup'),publicKey)
 await writeFile(join(directory,'COMPLETE.json'),JSON.stringify({completed_at:new Date().toISOString(),encrypted_assets:manifest.assets.length,encrypted_manifest:'manifest.btbackup'}),{flag:'wx',mode:0o600})
 console.log('Encrypted backup completed. Keep the recovery private key independently and exercise an isolated restore.')
}
