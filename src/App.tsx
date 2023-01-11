import React, { useEffect, useState } from 'react';
import './App.css';
import { clusterApiUrl, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction } from '@solana/web3.js';
import * as buffer from 'buffer';
window.Buffer = buffer.Buffer;

type DisplayEncoding = 'utf8' | 'hex';
type PhantomEvent = 'disconnect' | 'connect' | 'accountChanged';
type PhantomRequestMethod =
  | 'connect'
  | 'disconnect'
  | 'signTransaction'
  | 'signAllTransactions'
  | 'signMessage';

type ConnectOpts = {
	onlyIfTrusted: boolean;
};

type PhantomProvider = {
	publicKey: PublicKey | undefined;
	isConnected: boolean | undefined;
	signTransaction: (transaction: Transaction) => Promise<Transaction>;
	signAllTransactions: (transactions: Transaction[]) => Promise<Transaction[]>;
	signMessage: (
		message: Uint8Array | string,
		display?: DisplayEncoding
	) => Promise<any>;
	connect: (opts?: Partial<ConnectOpts>) => Promise<{publicKey: PublicKey}>;
	disconnect: () => Promise<void>;
	on: (event: PhantomEvent, handler: (args: any) => void) => void;
	request: (method: PhantomRequestMethod, params: any) => Promise<unknown>;
};

const getProvider = () => {
  if('solana' in window) {
    const provider = window.solana as any;
    
    if(provider.isPhantom) return provider as PhantomProvider;
  }
}

const connection = new Connection(clusterApiUrl('devnet', true), 'confirmed');

const App = () => {
  const [notification, setNotification] = useState<string>('');
  const [connectedWalletKey, setConnectedWalletKey] = useState<string | undefined>(undefined);
  const [connectedBalance, setConnectedBalance] = useState<number | undefined>();
  const [newWalletBalance, setNewWalletBalance] = useState<number | undefined>();
  const [newWallet, setNewWallet] = useState<Keypair | undefined>();
  const [loading, setLoading] = useState<boolean>(false);

  const connectProvider = async () => {
    const provider = getProvider();

    if(provider) {
      const res = await provider.connect();
      const balance = await getBalance(res.publicKey);
      if(balance) {
        setConnectedBalance(balance / LAMPORTS_PER_SOL);
      } else {
        setConnectedBalance(0);
      }
      setConnectedWalletKey(res.publicKey.toString());
    }
  }

  const disconnectProvider = async () => {
    const provider = getProvider();

    if(provider) {
      await provider.disconnect();
      setConnectedWalletKey(undefined);
    }
  }

  const getBalance = async (pubKey: PublicKey) => {
    try {  
      const balance = await connection.getBalance(pubKey);
      return balance;
    } catch (err) {
      console.log(err);
    }
  }

  const createWallet = async () => {
    setNotification('Generating a new keypair and airdropping some sol ...');
    try {
      const pair = Keypair.generate();
      setLoading(true);
      
      await requestAirdrop(pair.publicKey).then(async () => {
        await requestAirdrop(pair.publicKey);
      })
      
      const balance = await connection.getBalance(pair.publicKey);
      setNewWallet(pair);
      setNewWalletBalance(balance / LAMPORTS_PER_SOL);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
      setNotification('');
    }
  }

  const fetchBalances = async () => {
    if(connectedWalletKey) {
      const balance = await getBalance(new PublicKey(connectedWalletKey))
      if(balance) {
        setConnectedBalance(balance / LAMPORTS_PER_SOL);
      }
    }
    if(newWallet) {
      const balance = await getBalance(new PublicKey(newWallet.publicKey))
      if(balance) {
        setNewWalletBalance(balance / LAMPORTS_PER_SOL);
      }
    }
  }

  const requestAirdrop = async (pubKey: PublicKey) => {
    try {
      const airdrop = await connection.requestAirdrop(new PublicKey(pubKey), 2 * LAMPORTS_PER_SOL);
      
      let latestBlockHash = await connection.getLatestBlockhash();
      
      await connection.confirmTransaction({
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        signature: airdrop,
      });
    } catch (err) {
      console.log(err);
    }
  }

  const transfer = async () => {
    if(!newWallet || !connectedWalletKey) {
      return;
    }
    setNotification('Transfering sol ...')
    try {
      setLoading(true);
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(newWallet.publicKey),
          toPubkey: new PublicKey(connectedWalletKey),
          lamports: 2 * LAMPORTS_PER_SOL,
        })
      )
      
      await sendAndConfirmTransaction(connection, transaction, [newWallet]);
      await fetchBalances();
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
      setNotification('')
    }
  }

  return (
    <div>
      <h2>Connect Your Wallet And Transfer SOL !</h2>
      {!connectedWalletKey &&
        <button onClick={connectProvider} className="btn connect-btn">Connect Wallet</button>
      }
      <div className='card-holder'>
        <div className='card'>
          <h3>New Wallet</h3>
          {!newWallet && 
            <button onClick={createWallet} className="btn">Create wallet</button>
          }
          {newWallet && <div>
            {newWallet.publicKey.toString()}<br/>
            {
              loading 
                ? 'loading ... ' 
                : `${newWalletBalance} SOL`
            }
          </div>}
          {
            connectedWalletKey && newWallet && <div>
              <button onClick={transfer} className="btn card-btn">Transfer SOL</button>{' '}
            </div>
          }
        </div>
        {connectedWalletKey && <div className='card'>
            <h3>Phantom</h3>
            {connectedWalletKey}<br/>
            {
              loading 
                ? 'loading ... ' 
                : `${connectedBalance} SOL`
            }
            <br />
            <button onClick={disconnectProvider} className="btn card-btn">Disconnect Wallet</button>
          </div>}
      </div>
      {
        notification.length ? <div className='notification'>
          {notification}
        </div> : null
      }
    </div>
  );
}

export default App;
