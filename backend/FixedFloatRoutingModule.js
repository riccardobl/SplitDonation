//@ts-check
import fetch from 'node-fetch';
import Crypto from 'crypto';
import ApiProvider from './ApiProvider.js';
import Module from './Module.js';
import Sane from '../common/Sane.js';
import { resolve } from 'path';

export default class FixedFloatRoutingModule extends Module{

    /**
     * @param {*} config 
     */
    constructor(config){
        super();

        /**
         * @type {any}
         * @private
         */
        this.config=config;

        /**
        * @type {number}
        * @private
        */
        this.lastCall=0;

        /**
        * @type {any}
        * @private
        */
        this.checkAliveCache={};
    }

    
    async register(apiProvider){
        this.apiProvider=apiProvider;
        this.apiProvider.registerApi("scoinbridge/route",async (data)=>{
            const currency = data.currency;
            const amount = data.amount;
            const depositAddress = data.depositAddress;
            return await this.createRoute(amount,currency,depositAddress);
        });          
        this.apiProvider.registerApi("scoinbridge/output",async (data)=>{
            const currency = data.currency;
            const amount = data.amount;
            return await this.getOutput(amount,currency);
        });
        this.apiProvider.registerApi("scoinbridge/checkalive",async (data)=>{
            const orderId = data.orderId;
            const orderToken = data.orderToken;
            const depositAddress = data.depositAddress;
            return await this.checkAlive(orderId,orderToken);
        });
        
    }

    /**
     * @private
     * @param {string} api 
     * @param {string} queryString 
     * @param {boolean} [fastCall]
     * @returns {Promise<any>} 
     */
    async fetchFixedFloat(api,queryString,fastCall){
        if(!fastCall&&Date.now()-this.lastCall<15000){
            throw "Out of limits";
        }
        if(!fastCall)this.lastCall=Date.now();
        const signature=Crypto.createHmac('sha256', this.config.fixedFloatSecret).update(queryString).digest('hex');
        const headers = {
            "X-API-KEY":this.config.fixedFloatApi,
            "X-API-SIGN":signature,
            "Content-Type": "application/x-www-form-urlencoded"
        };      
        const resp = (/** @type {any}*/(await fetch(`https://fixedfloat.com/api/v1/${api}`, {
            method: "POST",
            headers:headers,
            body: queryString
        }).then(res=>res.json())));
        if(resp.code!=0) throw resp.msg;
        return resp;    
    }


    /**
     * @private
     * @param {number} amount 
     * @param {string} currency 
     * @param {string} depositAddress 
     * @returns {Promise<Object<string,any>>}
     */
    async createRoute(amount, currency, depositAddress) {
        const queryString=`fromCurrency=BTCLN&toCurrency=${currency}&toQty=${amount}&toAddress=${depositAddress}&type=fixed`;
        const resp=await this.fetchFixedFloat("createOrder",queryString);
        const sats=Sane.float(resp.data.from.qty)* 100000000;
        const orderId=Sane.str(resp.data.id,{f:"[A-Za-z0-9\\_\\-\\.]+"});
        const orderToken=Sane.str(resp.data.token,{f:"[A-Za-z0-9\\_\\-\\.]+"});
        const invoice=Sane.str( resp.data.from.address,{f:"[A-Za-z0-9\\_\\-\\.]+"});
        return {
            "sats": sats,
            "orderId": orderId,
            "orderToken": orderToken,
            "invoice": invoice,
            "currency": currency,
            "depositAddress":depositAddress,
            "notice":`
                The other side of the transaction is routed through FixedFloat exchange and can be seen (or refunded) from the
                <a target="blank" href="https://fixedfloat.com/order/${orderId}">fixedfloat order page</a> 
                by providing the correct deposit address: ${depositAddress}. 
            `
        };
    }

    /**
     * @private
     * @param {number} amount 
     * @param {string} currency 
     * @returns {Promise<Object<string,any>>}
     */
    async getOutput(amount, currency) {
        
        const amountBtc=amount/100000000;
        const queryString=`fromCurrency=BTCLN&toCurrency=${currency}&fromQty=${amountBtc}&type=fixed`;
        const resp=await this.fetchFixedFloat("getPrice",queryString,true);
        return {
            "amount": Sane.float(resp.data.to.amount),
            "currency":currency
        };
    }


    /**
     * Get the status of an order
     * @private
     * @param {string} orderId 
     * @param {string} orderToken 
     * @returns {Promise<Object<string,any>>}
     */
     async checkAlive(orderId, orderToken) {
        if(this.checkAliveCache)this.checkAliveCache={};
        const cacheKey=`${orderId}_${orderToken}`;
        
        for(const [key,value] of Object.entries(this.checkAliveCache)){
            if(Date.now()-value.timestamp>1000){
                delete this.checkAliveCache[key];
            }
        }

        if(this.checkAliveCache[cacheKey])return this.checkAliveCache[cacheKey];

        const queryString=`id=${orderId}&token=${orderToken}`;
        const resp=await this.fetchFixedFloat("getOrder",queryString,true);
        console.log(resp);
        let status;
        let message;
        const secondsLeft=resp.data.left;
        if(resp.data.status == 4){
            status = 0;
            message = "Completed!";
        }else if(resp.data.status == 7){
            status = 1;
            message = "Transaction failed. Refund can be request at the order page.";
        }else if(resp.data.status == 5){
            status = 1;
            message="Expired.";
        }else{
            status = 2;
            message = "Bridging...";
        }
        return {
            "code": status,
            "desc":message,
            "secondsLeft":Sane.int(secondsLeft)
        };
    }

}