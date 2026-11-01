import {createCipheriv,createDecipheriv,publicEncrypt,privateDecrypt,randomBytes,constants} from 'node:crypto'
import {createWriteStream} from 'node:fs'
import {open,link,unlink} from 'node:fs/promises'
import {pipeline} from 'node:stream/promises'
const MAGIC=Buffer.from('BTBACKUP1')
/** Public key only: the export machine never needs the private recovery key. */
export async function encryptBackup(source,path,publicKey){
 const key=randomBytes(32),iv=randomBytes(12),wrapped=publicEncrypt({key:publicKey,oaepHash:'sha256',padding:constants.RSA_PKCS1_OAEP_PADDING},key)
 const length=Buffer.alloc(4);length.writeUInt32BE(wrapped.length)
 const header=Buffer.concat([MAGIC,length,iv,wrapped]),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(header)
 const partial=path+'.partial'
 let created=false
 try{
  // Refuse to overwrite either an earlier completed backup or a partial export.
  try{const existing=await open(path,'r');await existing.close();throw new Error('Backup destination already exists')}catch(error){if(error.code!=='ENOENT')throw error}
  const file=await open(partial,'wx',0o600);created=true;await file.writeFile(header);await file.close()
  await pipeline(source,cipher,createWriteStream(partial,{flags:'a',mode:0o600}))
  const finished=await open(partial,'a');await finished.writeFile(cipher.getAuthTag());await finished.sync();await finished.close()
  await link(partial,path);await unlink(partial)
 }catch(error){if(created)await unlink(partial).catch(()=>{});throw error}finally{key.fill(0)}
}
/** Used for isolated restore checks; large production restores must stream to disk. */
export function decryptBackup(bytes,privateKey){
 if(bytes.length<41||!bytes.subarray(0,MAGIC.length).equals(MAGIC))throw new Error('Invalid encrypted backup')
 const length=bytes.readUInt32BE(MAGIC.length),offset=MAGIC.length+4+12+length
 if(length<128||length>1024||offset+16>bytes.length)throw new Error('Invalid encrypted backup')
 const iv=bytes.subarray(MAGIC.length+4,MAGIC.length+16),wrapped=bytes.subarray(MAGIC.length+16,offset),key=privateDecrypt({key:privateKey,oaepHash:'sha256',padding:constants.RSA_PKCS1_OAEP_PADDING},wrapped)
 try{const decipher=createDecipheriv('aes-256-gcm',key,iv);decipher.setAAD(bytes.subarray(0,offset));decipher.setAuthTag(bytes.subarray(-16));return Buffer.concat([decipher.update(bytes.subarray(offset,-16)),decipher.final()])}finally{key.fill(0)}
}
