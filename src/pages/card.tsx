import { useState, useEffect, useMemo } from 'react';
import TestImage from '../assets/test.png'
import Logo from '../assets/mark.png'
export default function RaffleCard(props : any){

    const [time, setTime] = useState<any>({day : 0, hour : 0, min : 0, sec : 0})
    
    
    let remainingTime = props.item.startTime.toNumber()+props.item.period.toNumber()-Math.floor((new Date()).getTime()/1000)

    useEffect(()=>{
        let interval = setInterval(()=>{
            getRemainingTime()
        },1000)
        return ()=>clearInterval(interval)
    },[])

    const getRemainingTime = () =>{
        let num = remainingTime
        if(num < 0){
            setTime({day : 0, hour : 0, min : 0, sec : 0})
        }else{
            let day = Math.floor(num/86400)
            num -= day*86400
            let hour = Math.floor(num/3600)
            num -= hour*3600
            let min = Math.floor(num/60)
            let sec = num - min*60
            setTime({day : day, hour : hour, min : min, sec : sec})
        }
        remainingTime--;
    }

    return <div className={props.item.status===1 ? 'card' :'card grayscale'} onClick={()=>{
        // window.location.href = "/"+props.item.address.toBase58()
        props.callback(props.item.address.toBase58())
    }}>
        <img className='card-img-top' src={props.item.logo!=="" ? props.item.logo : TestImage} alt="test"></img>
        <h5 className='card-title'>{props.item.roomName}</h5>
        <div className='row mb-3'>
            <div className='col-6'>
                🎟️ {props.item.soldTicket} sold
            </div>
            <div className='col-6'>
                {props.item.spotNum}  winner
            </div>
        </div>
        <div className='mb-3'>
            <span className='live-dot'></span> {props.item.status==1 ? time.day+"days(s) "+time.hour+"hours "+time.min+"min(s) "+time.sec+"sec(s)" : "Raffle ended"}
        </div>
        <div>
            <button type="button" className='btn btn-lg btn-detail'>{props.item.status===1 ? "Join Raffle" : "View Detail"}</button>
        </div>
    </div>
}