  'use client'

  import React, { useState, useEffect, useCallback } from 'react';
  import { ethers, MaxUint256 } from 'ethers';

  const minimalSFMAbi = [
    {
        "constant": true,
        "inputs": [
            {
                "name": "_owner",
                "type": "address"
            }
        ],
        "name": "balanceOf",
        "outputs": [
            {
                "name": "balance",
                "type": "uint256"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [
            {
                "name": "_spender",
                "type": "address"
            },
            {
                "name": "_value",
                "type": "uint256"
            }
        ],
        "name": "approve",
        "outputs": [
            {
                "name": "",
                "type": "bool"
            }
        ],
        "payable": false,
        "stateMutability": "nonpayable",
        "type":"function"
    },
    {
        "constant": true,
        "inputs": [
            {
                "name": "_owner",
                "type":"address"
            },
            {
                "name":"_spender",
                "type":"address"
            }
        ],
        "name":"allowance",
        "outputs":[
            {
                "name":"",
                "type":"uint256"
            }
        ],
        "payable":false,
        "stateMutability":"view",
        "type":"function"
    }
  ]

  const migrationABI = [
    {
      "inputs":[
        {
          "internalType":"uint256",
          "name":"_amount",
          "type":"uint256"
        }
      ],
      "name":"migrate",
      "outputs":[
        {
          "internalType":"uint256",
          "name":"",
          "type":"uint256"
        }
      ],
      "stateMutability":"nonpayable",
      "type":"function"
    }
  ]

  const migrationCA = '0x9d50518de14f89836f2b9b9ac05f177de7bf521a'
  const v1CA = '0x8076C74C5e3F5852037F31Ff0093Eeb8c8ADd8D3'

  function App() {
    const [account, setAccount] = useState(null);
    const [contract, setContract] = useState(null);
    const [migration, setMigration] = useState(null);
    const [balance, setBalance] = useState(0);
    const [isApproved, setIsApproved] = useState(false);
    const [buttonMSG, setButtonMSG] = useState('Migrate');
    const [provider, setProvider] = useState(null);
    const [ping, setPing] = useState(0); // There has to be a better way to do this but i dont like react and i dont want to learn react


    useEffect(() => {
      if (window.ethereum) {
        window.ethereum.on('accountsChanged', (accounts) => {
          if (accounts.length > 0) {
            console.log('Account changed to:', accounts[0]);
            setAccount(accounts[0]);
            setPing(ping+ 1);
          } else {
            console.log('No accounts connected');
            setAccount(null);
          }
        });
        window.ethereum.on('chainChanged', (chainId) => {
          console.log('Network changed to:', chainId);
          switchNetwork(); // This forces the user to switch to bsc? Lmao
        });
    
        return () => {
          window.ethereum.removeListener('accountsChanged', () => {});
          window.ethereum.removeListener('chainChanged', () => {});
        };
      }
    }, []);

    const switchNetwork = useCallback(async () => {
      if (!window.ethereum) {
          console.error("MetaMask is not installed!");
          return;
      }
      const bscNetworkData = {
          chainId: "0x38", // bsc
          chainName: "Binance Smart Chain",
          nativeCurrency: {
              name: "Binance Coin",
              symbol: "BNB",
              decimals: 18,
          },
          rpcUrls: ["https://bsc-dataseed.binance.org/"],
          blockExplorerUrls: ["https://bscscan.com"],
      };

      try {
          await window.ethereum.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: bscNetworkData.chainId }],
          });
          console.log("Switched to Binance Smart Chain");
          setPing(ping + 1);
      } catch (error) {
          if (error.code === 4902) { // This is cool, been a while i didnt build UIs
              try {
                  await window.ethereum.request({
                      method: "wallet_addEthereumChain",
                      params: [bscNetworkData],
                  });
                  console.log("Binance Smart Chain has been added and switched to.");
              } catch (addError) {
                  console.error("Failed to add Binance Smart Chain:", addError);
              }
          }
      }

    }, []);
    const connectWalletAndGetContracts = useCallback(async () => {
      try {
        if (typeof window.ethereum !== 'undefined') {
          const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
          const connectedAccount = accounts[0];
          setAccount(connectedAccount);

          const tempProvider = new ethers.BrowserProvider(window.ethereum);
          setProvider(tempProvider);
        } else {
          alert('Please install MetaMask or another web3 wallet!');
        }
      } catch (err) {
        console.error(err);
      }
    }, []);

    useEffect(() => {
      const setupContracts = async () => {
        if (provider && account) {
          const network = await provider.getNetwork();
          if (network.chainId !== 56) {
            await switchNetwork();
          }

          const signer = await provider.getSigner();
          const v1Contract = new ethers.Contract(v1CA, minimalSFMAbi, signer);
          const migrationContract = new ethers.Contract(migrationCA, migrationABI, signer);
          setContract(v1Contract);
          setMigration(migrationContract);
        }
      };
      setupContracts();
    }, [provider, account, ping]);

    useEffect(() => {
      const setInfos = async () => {
        if (contract && migration && account) {
          const bal = await contract.balanceOf(account);
          const balFormatted = ethers.formatUnits(bal, 9);
          console.log("act", account, "bal", balFormatted, "SFM v1 CA", v1CA);
          setBalance(balFormatted);
          const allowance = await contract.allowance(account, migrationCA);
          const isAllApproved = allowance >= bal;
          setIsApproved(isAllApproved);
          setButtonMSG(isAllApproved ? 'Migrate' : 'Approve');
        }
      };
      setInfos();
    }, [contract, migration, account, ping]);


    const takeAction = useCallback(async () => {
      if (!migration || !contract || !account || balance === 0) return;

      const parsedBalance = ethers.parseUnits(balance.toString(), 9);
      if (isApproved) {
        try {
          console.log("parsedBalance", parsedBalance, "migrationCA", migrationCA);
          const tx = await migration.migrate(parsedBalance);
          await tx.wait();
          console.log("Migration :", tx.hash);
          setPing(ping + 1);
        } catch (error) {
          console.error("Error migrating:", error);
          alert("Something went wrong with the transaction! If you feel like this shouldnt have happened, contact nova on discord with the following: \n\n" + error.message);
        }
      } else {
        try {
          const tx = await contract.approve(migrationCA, MaxUint256);
          await tx.wait();
          console.log("approval: ", tx.hash);
          const allowance = await contract.allowance(account, migrationCA);
          setIsApproved(allowance >= parsedBalance);
          setPing(ping + 1);
          setButtonMSG('Migrate');
        } catch (error) {
          console.error("Error approving:", error);
          alert("Something went wrong with the transaction! If you feel like this shouldnt have happened, contact nova on discord with the following: \n\n" + error.message);
        }
      }
    }, [migration, contract, account, balance, isApproved]);








    // Thanks chatGPT for the css
    return (
      <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', textAlign: 'center' }}>
          {/* Connect Wallet Section */}
          {account ? (
            <p style={{ fontSize: '0.9rem', color: '#333' }}>
              Connected: {account}
            </p>
          ) : (
            <button
              onClick={connectWalletAndGetContracts}
              style={{
                padding: '10px 20px',
                fontSize: '1rem',
                border: '1px solid #aaa',
                borderRadius: '4px',
                backgroundColor: '#f0f0f0',
                cursor: 'pointer',
                outline: 'none',
                marginBottom: '20px'
              }}
            >
              Connect Wallet
            </button>
          )}
        <h1>SFM V1 Balance</h1>
        <div style={{ marginBottom: '20px' }}>
        </div>

        <input
          type="text"
          value={balance}
          readOnly
          style={{
            minWidth: '50px',
            width: `${balance.length + 2}ch`, // Dynamic width based on content length
            textAlign: 'center',
            fontSize: '1.5rem',
            marginBottom: '20px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            padding: '5px'
          }}
        />
        <br />
        <button
          onClick={takeAction}
          style={{
            padding: '10px 20px',
            fontSize: '1rem',
            border: '1px solid #aaa',
            borderRadius: '4px',
            backgroundColor: '#f0f0f0',
            cursor: 'pointer',
            marginBottom: '20px',
            outline: 'none'
          }}
        >
          {buttonMSG}
        </button>

        <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '20px' }}>
        Always double-check the address and transaction details before confirming.
      </p>
      <p style={{ fontSize: '0.8rem', color: '#888' }}>
        (Awful) source code available <a href="https://github.com/Nova1111111/sfm-migration-recovery-tool" style={{ color: '#555', textDecoration: 'underline' }}> here</a>.
      </p>
      <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '20px' }}>
        Note: I will not be paying to keep this thing up.
      </p>
      </div>
    );
  }

  export default App;
