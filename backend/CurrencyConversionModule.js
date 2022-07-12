//@ts-check
import fetch from 'node-fetch';
import Sane from '../common/Sane.js';
import ApiProvider from './ApiProvider.js';
import Module from './Module.js';


export default class CurrencyConversionModule extends Module{
   
    /**
     * 
     * @param {*} config 
     */
    constructor(config){
        super();

        /**
        * @type {Object<String,*>}
        * @private
        */
        this.prices={};
        
    }

    async register(apiProvider){
        apiProvider.registerApi("prices/BTCUSD",async (req)=>{
            return this.getPrice("BTC","USDT");
        });          
    }


    /**
     * @private
     * @param {string} a 
     * @param {string} b 
     * @returns {Promise<Object>}
     */
    async getPrice(a,b){
        const symbol=a+b;
        if(!this.prices[symbol] || !this.prices[symbol].value|| Date.now()-this.prices[symbol].lastUpdate > 1200000){
            const apis=[
                "https://api.binance.com",
                "https://api1.binance.com",
                "https://api2.binance.com",
                "https://api3.binance.com"
            ];

            for(const api of apis){
                try{
                    const res=(await fetch(`${api}/api/v3/avgPrice?symbol=${symbol}`).then(res=>res.json()));
                    this.prices[symbol]={
                        value:Sane.float((/** @type {Object} */ (res)).price),
                        lastUpdate:Date.now()
                    };
                }catch(e){
                    console.error(e);
                }
                break;
            }
        }

        if(!this.prices[symbol]||!this.prices[symbol].value)throw `Unable to fetch ${symbol} price`;
        return {
            value:this.prices[symbol].value,
            message: `${a}/${b}  exchange rate is indicative and updated once every 20 minutes from Binance.com`
        }
    }
    

    
}