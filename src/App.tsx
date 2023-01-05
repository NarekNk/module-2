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
    const solana = window.solana as any;

    if(solana.isPhantom) return solana as PhantomProvider;
  }
}

const App = () => {
  const [provider, setProvider] = useState<PhantomProvider | undefined>();
  const [connectedWalletKey, setConnectedWalletKey] = useState<string | undefined>(undefined);
  const [connectedBalance, setConnectedBalance] = useState<number | undefined>();
  const [newWalletBalance, setNewWalletBalance] = useState<number | undefined>();
  const [newWallet, setNewWallet] = useState<Keypair | undefined>();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);

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
      const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
  
      const balance = await connection.getBalance(pubKey);
      return balance;
    } catch (err) {
      console.log(err);
    }
  }

  const createWallet = async () => {
    try {
      const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
  
      const pair = Keypair.generate();
      const transaction = await connection.requestAirdrop(new PublicKey(pair.publicKey), 2 * LAMPORTS_PER_SOL);
  
      await connection.confirmTransaction(transaction);
      
      const balance = await getBalance(pair.publicKey);

      if(balance) {
        setNewWalletBalance(balance / LAMPORTS_PER_SOL);
      } else {
        setNewWalletBalance(0);
      }

      setNewWallet(pair);
    } catch (err) {
      console.log(err);
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
      const balance = await getBalance(newWallet?.publicKey as PublicKey)
      if(balance) {
        setNewWalletBalance(balance / LAMPORTS_PER_SOL);
      }
    }
  }

  const transfer = async () => {
    if(!newWallet || !connectedWalletKey) {
      return;
    }
    try {
      setLoading(true);
      const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

      const balance = await getBalance(newWallet.publicKey);
      // assume commission is 0.1 SOL
      if(!balance || balance <= (amount + 0.1) * LAMPORTS_PER_SOL) {
        setError('Not enough SOL in account');
        return;
      }
      setError('');
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(newWallet.publicKey),
          toPubkey: new PublicKey(connectedWalletKey),
          lamports: amount * LAMPORTS_PER_SOL,
        })
      )

      await sendAndConfirmTransaction(connection, transaction, [newWallet]);
      await fetchBalances();
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const provider = getProvider();

    if(provider) {
      setProvider(provider);
    } else {
      setProvider(undefined);
    }
  }, []);

  return (
    <div>
      <h2>Connect Your Wallet And Transfer SOL !</h2>
      {!connectedWalletKey &&
        <button onClick={connectProvider} className="btn connect-btn">Connect Wallet</button>
      }
      <div className='card-holder'>
        <div className='card'>
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
          <p className='error'>
            {error}
          </p>
          {
            connectedWalletKey && newWallet && <div>
              <input type="number" value={amount} onChange={(e) => setAmount(+e.target.value)} className="input" step={0.1}/>
              <button onClick={transfer} className="btn card-btn">Transfer SOL</button>
            </div>
          }
        </div>
        {connectedWalletKey && <div className='card'>
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

    </div>
  );
}

export default App;
