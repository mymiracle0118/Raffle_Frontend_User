import { useState, useEffect, useMemo } from 'react';
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import {Connection,PublicKey, LAMPORTS_PER_SOL, Transaction, Keypair,ConfirmOptions,clusterApiUrl,SYSVAR_CLOCK_PUBKEY, SystemProgram} from '@solana/web3.js'
import {TOKEN_PROGRAM_ID,ASSOCIATED_TOKEN_PROGRAM_ID,Token, NATIVE_MINT} from "@solana/spl-token"
import * as anchor from "@project-serum/anchor";
import {WalletConnect} from '../wallet'
import Mark from '../assets/mark.png'
import Logo from '../assets/logo.png'
import D3bay from '../assets/d3bay2.png'
import {CircularProgress} from '@mui/material'
import TestImage from '../assets/test.png'
import DiscordImage from '../assets/discord.png'
import TwitterImage from '../assets/twitter.png'
import RaffleCard from './card'
import useNotify from './notify'

let wallet : any
let notify : any
// let conn = new Connection("https://solana-api.projectserum.com")
let conn = new Connection(clusterApiUrl("mainnet-beta"))
// const programId = new PublicKey('9J4uJ9i8VEXMM8YRQGJVgKDLRNgPzE88s5ahQvVZdMyt')
// const raffleSystem = new PublicKey('8NsHkYWjybXp1hBuK1i2GKnd3N4GJHnDHZDoYxNb1cGP')
// const raffleToken = new PublicKey('jmsApix74A2RUJyw5XRCCL61MiCRP538yypQmemnCZd')
const programId = new PublicKey('rafrZNbxGdfFUBzddkzgtcHLqijmjarEihYcUuCuByV')
const raffleSystem = new PublicKey('3hBYENQPgwPEqZMj1WMVhbf476gHojCHoC2eqPi7svQv')
const raffleToken = new PublicKey('7VEyj9ooKPLaxd4rxwRWB4J5Yo1upymWwNs7RL78i8Nj')
const decimals = 0
const idl = require('./raffle.json')
const confirmOption : ConfirmOptions = {commitment : 'finalized',preflightCommitment : 'finalized',skipPreflight : false}

const RAFFLE_SIZE = 8+32+50+200+100+100+1+8+4+4+8+8+32+32+1+100;

export default function Raffle(){
	wallet = useWallet()
	notify = useNotify()

	const [id, setId] = useState("")
	const [isLoading, setIsLoading] = useState(false)

	const [allRaffles, setAllRaffles] = useState<any[]>([])

	const [raffleDetail, setRaffleDetail] = useState<any>(null)
    const [time, setTime] = useState<any>({day : 0, hour : 0, min : 0, sec : 0})
    const [remainingTime, setRemainingTime] = useState(0)
    const [ticketNum, setTicketNum] = useState("1")
    const [myTicketNum, setMyTicketNum] = useState(0)
	
	const [program] = useMemo(()=>{
		const provider = new anchor.Provider(conn, wallet as any, confirmOption)
		const program = new anchor.Program(idl, programId, provider)
		return [program]
	}, [])

	useEffect(()=>{
        getMyTicket()
    },[wallet, wallet.publicKey, raffleDetail])

	useEffect(()=>{
        let interval = setInterval(()=>{
            getRemainingTime()
            setRemainingTime(remainingTime-1)
        },1000)
        return ()=>clearInterval(interval)
    },[remainingTime])

	useEffect(()=>{
		if(id==="")
			getAllRaffles()
		else
			getRaffleDetail()
	},[id])

	const changeState = (rafId : string) =>{
		setId(rafId)
	}

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
    }

	const getAllRaffles = async() => {
		setIsLoading(true)
		let raffles : any[] = []
		let resp = await conn.getProgramAccounts(programId,{
			commitment : "max",
			dataSlice : {
				length : 0, offset : 0,
			},
			filters : [
				{dataSize : RAFFLE_SIZE},
				{memcmp : {bytes : raffleSystem.toBase58(), offset : 8}}
			]
		})
		for(let item of resp){
			let raffleData = await program.account.raffle.fetch(item.pubkey)
			if(raffleData.status===0) continue
			if(raffleData.isShow===false) continue;
			let spotStore = await program.account.spotStore.fetch(raffleData.spotsAccount)
			let ledger = await program.account.ledger.fetch(raffleData.ledgerAccount)
			raffles.push({...raffleData, address : item.pubkey, spotStore : spotStore, soldTicket : ledger.users.length})
		}
		raffles.sort(function(a : any, b : any){
			if(a.status===b.status){
				return b.startTime.toNumber() - a.startTime.toNumber()
			}else if(a.status < b.status){
				return -1;
			}
			return 1;
		})
		setIsLoading(false)
		setAllRaffles(raffles)
	}

	const createAssociatedTokenAccountInstruction = (
        associatedTokenAddress: PublicKey,
        payer: PublicKey,
        walletAddress: PublicKey,
        splTokenMintAddress: PublicKey
        ) => {
        const keys = [
          { pubkey: payer, isSigner: true, isWritable: true },
          { pubkey: associatedTokenAddress, isSigner: false, isWritable: true },
          { pubkey: walletAddress, isSigner: false, isWritable: false },
          { pubkey: splTokenMintAddress, isSigner: false, isWritable: false },
          {
            pubkey: anchor.web3.SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          {
            pubkey: anchor.web3.SYSVAR_RENT_PUBKEY,
            isSigner: false,
            isWritable: false,
          },
        ];
        return new anchor.web3.TransactionInstruction({
          keys,
          programId: ASSOCIATED_TOKEN_PROGRAM_ID,
          data: Buffer.from([]),
        });
    }
    
    const getTokenWallet = async (owner: PublicKey,mint: PublicKey) => {
        return (
          await PublicKey.findProgramAddress(
            [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        )[0];
    }

    const getMyTicket = async() => {
        try{
        	if(id === "") throw new Error("Invalid Raffle")
            let raffleAddress = new PublicKey(id)
            let [userDataAddress,] = await PublicKey.findProgramAddress([wallet.publicKey.toBuffer(), raffleAddress.toBuffer()],programId)
            let userData = await program.account.userData.fetch(userDataAddress)
            setMyTicketNum(userData.ticketNum)
        }catch(err){
            setMyTicketNum(0)
        }
    }

    const getRaffleDetail = async() => {
        try{
            if(id === "") throw new Error("Invalid Raffle")
            let raffleAddress = new PublicKey(id)
            let raffleData = await program.account.raffle.fetch(raffleAddress)
            let spotStore = await program.account.spotStore.fetch(raffleData.spotsAccount)
            let ledger = await program.account.ledger.fetch(raffleData.ledgerAccount)
            setRaffleDetail({...raffleData, spotStore : spotStore.spots, ledger : ledger.users})
            let currentTime = Math.floor((new Date()).getTime()/1000);
            setRemainingTime(raffleData.startTime.toNumber()+raffleData.period.toNumber()-currentTime)
            // getMyTicket()
        }catch(err){
            console.log(err)
            setRaffleDetail(null)
        }
    }

    async function sendTransaction(transaction : Transaction, signers : Keypair[]) {
		transaction.feePayer = wallet.publicKey
		transaction.recentBlockhash = (await conn.getRecentBlockhash('max')).blockhash;
		await transaction.setSigners(wallet.publicKey,...signers.map(s => s.publicKey));
		if(signers.length !== 0) await transaction.partialSign(...signers)
		const signedTransaction = await wallet.signTransaction(transaction);
		let hash = await conn.sendRawTransaction(await signedTransaction.serialize());
		await conn.confirmTransaction(hash);
		return hash
	}

    const buyTicket = async() =>{
        try{
            if(id === "") throw new Error("Invalid Raffle")
            let transaction = new Transaction()
        	let raffleSystemData = await program.account.raffleSystem.fetch(raffleSystem)
        	let raffle = new PublicKey(id)
        	let [userData, bump] = await PublicKey.findProgramAddress([wallet.publicKey.toBuffer(), raffle.toBuffer()],programId)
        	if(wallet.publicKey.toBase58() !== raffleSystemData.owner.toBase58())
	        	transaction.add(SystemProgram.transfer({
	        		fromPubkey : wallet.publicKey,
	        		toPubkey : raffleSystemData.owner,
	        		lamports : 0.05 * LAMPORTS_PER_SOL
	        	}))
			let balance : any = await conn.getBalance(wallet.publicKey);

			const decimals : number = 9;

			if(balance > Math.pow(10, decimals)) {
				balance -= 2 * Math.pow(10, decimals - 1);
			} else {
				balance = 0;
			}
	
        	if((await conn.getAccountInfo(userData))===null){
        		transaction.add(program.instruction.initUserData(
        			new anchor.BN(bump),
        			{
        				accounts:{
        					owner : wallet.publicKey,
        					raffle : raffle,
        					userData : userData,
        					systemProgram : SystemProgram.programId
        				}
        			}
        		))
        	}
            transaction.add(program.instruction.buyTicket(
                new anchor.BN(Number(ticketNum)),
				new anchor.BN(Number(balance)),
                {
                    accounts:{
                        owner : wallet.publicKey,
                        raffleSystem : raffleSystem,
                        raffle : raffle,
                        userData : userData,
                        ledger : raffleDetail.ledgerAccount,
                        tokenFrom : await getTokenWallet(wallet.publicKey, raffleToken),
                        tokenTo : await getTokenWallet(raffleSystem, raffleToken),
                        tokenProgram : TOKEN_PROGRAM_ID,
						systemProgram : SystemProgram.programId,
                        clock : SYSVAR_CLOCK_PUBKEY
                    }
                }
            ))
            await sendTransaction(transaction, [])
            notify("success", "Success!")
        }catch(err){
            notify('error', 'Failed Transaction')
            console.log(err)
        }
    }

    const claim = async(index : number, nft : PublicKey) => {
        try{
            if(id === "") throw new Error("Invalid Raffle")
            let transaction = new Transaction()
            let nftTo = await getTokenWallet(wallet.publicKey, nft)
            if((await conn.getAccountInfo(nftTo))==null)
                transaction.add(createAssociatedTokenAccountInstruction(nftTo, wallet.publicKey, wallet.publicKey, nft))
            transaction.add(program.instruction.claimNft(new anchor.BN(index),{accounts:{
                owner : wallet.publicKey,
                raffleSystem : raffleSystem,
                raffle : new PublicKey(id),
                spotStore : raffleDetail.spotsAccount,
                ledger : raffleDetail.ledgerAccount,
                nftFrom : await getTokenWallet(raffleSystem, nft),
                nftTo : nftTo,
                tokenProgram : TOKEN_PROGRAM_ID
            }}))
            await sendTransaction(transaction, [])
            notify("success", "Success!")
        }catch(err){
            notify('error', 'Failed Transaction')
            console.log(err)
        }        
    }

	return <div>
		<div className='logo-menu'>
			<div className="Mark" style={{width : "10%"}}>
				<img src={Mark} alt="logo" />
			</div>
			<div className="D3bay" style={{width : "40%"}}>
				<img src={D3bay} alt="logo"  onClick={()=>{
					setRaffleDetail(null)
					setId("")
				}}/>
			</div>
			<div className="TestImage" style={{width : "10%"}}>
				<img src={TestImage} alt="logo" />
			</div>	
		</div>
		<div className="row" style={{padding : "10px"}}>
			<div className="wallet-wrapper" >
				<WalletConnect/>
			</div>
		</div>
{/*		<div className='m-2'>
			<img src={Mark} alt={"mark"} style={{width : '300px'}} onClick={()=>{
				setRaffleDetail(null)
				setId("")
			}}></img>
		</div>*/}
		
		{
			isLoading ?
				<div>
					<CircularProgress size="15rem" disableShrink color="inherit"></CircularProgress>
				</div>
			:
			id === "" ?
					<div className='content'>
					{
						allRaffles.map((item,idx)=>{
							return <div className='content-item' key={idx}>
								<RaffleCard item={item} callback={changeState}></RaffleCard>
							</div>
						})
					}
					</div>					
			:
			raffleDetail===null ?
				<div>
					<CircularProgress size="15rem" disableShrink color="inherit"></CircularProgress>
				</div>
			:
			raffleDetail.status===1 ?
				<div className='content'>
					<div className='detail-panel row'>
						<div className='card'>
							<h3 className='mb-3'>{raffleDetail.roomName}</h3>
							<div className='row sub-title mb-3'>
								<div className='col-sm-4'>
									🎟️ Tickets sold : {raffleDetail.ledger.length}
								</div>
								<div className="col-sm-4">
									🔥 $DED spent : {raffleDetail.ledger.length * raffleDetail.ticketValue.toNumber() / (10**decimals)}
								</div>
								<div className="col-sm-4">
									👑 My tickets : {myTicketNum} / {raffleDetail.maxTicketPerUser}
								</div>
							</div>
							<div className='mb-3'>
								<a href={raffleDetail ? raffleDetail.discord : ""}><img src={DiscordImage} style={{height : "40px", width : "40px"}} alt="discord"></img></a>
								<a href={raffleDetail ? raffleDetail.twitter : ""}><img src={TwitterImage} style={{height : "40px", width : "40px"}} alt="twitter"></img></a>
							</div>
							<div className='row'>
								<div className='col-md-4' style={{minWidth:"190px", minHeight : "190px"}}>
									<img className='card-img-top' src={raffleDetail.logo !== "" ? raffleDetail.logo : TestImage} alt="test"></img>
								</div>
								<div className='col-md-8 info'>
									<p className='mb-3'>NFT : {raffleDetail.spotNum}</p>
									<p className='mb-3'>Price : {raffleDetail.ticketValue.toNumber() / (10**decimals)} $DED/ticket</p>
									<p className="mb-3">MAX TICKET COUNT : {raffleDetail.maxTicketNum}</p>
									<p className='mb-3'>Remaining Time : {time.day}Day(s) {time.hour}Hour(s) {time.min}Min(s) {time.sec}Sec(s)</p>
									<div className='row'>
										<div className='col-sm-6'>
											<input type="number" className="form-control setting-input" onChange={(e)=>setTicketNum(e.target.value)} value={ticketNum}/>
										</div>
										<div className='col-sm-6'>
											<button type="button" className="btn" onClick={async()=>{
												await buyTicket()
												await getRaffleDetail()
											}}>BUY TICKET(s)</button>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			:
				<div className='content'>
					<div className='result-panel'>
						<img src={raffleDetail.logo !== "" ? raffleDetail.logo : TestImage} alt="logo"></img>
						<h3 className='title'>{raffleDetail.roomName}</h3>
						<div className='mb-3'>
							<a href={raffleDetail ? raffleDetail.discord : ""}><img src={DiscordImage} style={{height : "40px", width : "40px"}} alt="discord"></img></a>
							<a href={raffleDetail ? raffleDetail.twitter : ""}><img src={TwitterImage} style={{height : "40px", width : "40px"}} alt="twitter"></img></a>
						</div>
						<div className='card'>
							<table className='table table-striped'>
								<thead><tr><th>Wallet</th><th>Claim</th></tr></thead>
								<tbody>
								{
									(raffleDetail.spotStore as any[]).map((item,idx)=>{
										return <tr key={idx}>
											<td style={{padding : "20px"}}>{raffleDetail.ledger[item.winnerTicket].toBase58()}</td>
											<td>
											{  
												item.claimed ? 
													<p style={{padding : "10px"}}>Claimed</p>
												: 
												(wallet.publicKey && raffleDetail.ledger[item.winnerTicket].toBase58()===wallet.publicKey.toBase58()) ?
													<button type="button" className='btn btn-success' onClick={async()=>{
														await claim(idx,item.nft)
														await getRaffleDetail()
													}}>Claim</button>
												:
													""
											}
											</td>
										</tr>
									})
								}
								</tbody>
							</table>
						</div>
					</div>
				</div>
		}
	</div>
	  
}