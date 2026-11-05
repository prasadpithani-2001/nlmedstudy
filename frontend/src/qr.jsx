import {useEffect,useState} from 'react'
import QRCode from 'qrcode'
/** Draws a real, scannable QR code for any text (used for the UPI payment link). */
export function QrImg({text,size=240,label='QR code'}){
 const [src,setSrc]=useState('')
 useEffect(()=>{let live=true;if(!text){setSrc('');return}
  QRCode.toDataURL(text,{width:size*2,margin:2,errorCorrectionLevel:'M',color:{dark:'#14213d',light:'#ffffff'}}).then(u=>live&&setSrc(u)).catch(()=>live&&setSrc(''))
  return()=>{live=false}},[text,size])
 if(!src)return <div style={{width:size,height:size}} className="animate-pulse rounded-xl bg-stone-200"/>
 return <img src={src} width={size} height={size} alt={label} className="rounded-xl bg-white p-1 shadow"/>}
