//@ts-check
import LnToolsInvoice from '@lntools/invoice';
import LnUrlPay from 'lnurl-pay';
import Module from './Module.js';
import Utils from './Utils.js';

export default class LightningModule extends Module {
    
    constructor() {
        super();
        // this.timeSinceLastInvoice=0;

    }
    /**
     * @private
     * @param {string} invoice 
     * @param {number} [amountSats]
     * @returns {Promise<Object>}
     */
    async decodeInvoice(invoice, amountSats) {
        const decodedInvoice = LnToolsInvoice.decode(invoice);
        if (typeof amountSats != "undefined" && new Number(decodedInvoice.valueSat) != amountSats) throw "Invalid invoice!";
        const out = {
            invoice: invoice.toString(),
            expiry: decodedInvoice.expiry,
            timestamp: decodedInvoice.timestamp,
            payHash: decodedInvoice.paymentHash.toString('hex'),
            sats: Number.parseInt(decodedInvoice.valueSat)
        };
        return out;
    }


    async register(apiProvider) {
        apiProvider.registerApi("decode_invoice", async (data) => {
            const invoice = data.invoice;
            const sats = data.sats;
            return await this.decodeInvoice(invoice, sats);
        });
        apiProvider.registerApi("invoice", async (data) => {
            const addr = data.addr;
            const sats = data.sats;
            const comment = data.comment;
            return await this.generateInvoice(addr, sats,comment);
        });
    }

    /**
     * @private
     * @param {string} addr 
     * @param {number} amountSats 
     * @param {string} [comment ]
     * @param {number} [retry] number of attempts
     * @returns 
     */
    async generateInvoice(addr, amountSats, comment, retry) {
        if (!addr || !amountSats) throw "Addr or Amount unset";
        comment=comment?(comment.length>32?comment.substring(0,32):comment):undefined;
        
        let invoice=undefined;
        let lastE=undefined;
        for(let i=0;i<(retry?retry:3);i++){
            try{
                const out  = await LnUrlPay.requestInvoice({
                    lnUrlOrAddress: addr,
                    tokens: LnUrlPay.utils.toSats(amountSats), // satoshis
                    comment: comment
                });
                lastE=undefined;
                invoice=out.invoice;
            }catch(e){
                lastE=e;
                if(e.message.includes(" 429")||e.message.includes(" 400")){
                    i--;
                    await Utils.sleep(500);
                }else{
                    await Utils.sleep(100);
                }
                continue;            
            }
        }
        if(lastE)throw lastE;
        if(!invoice)throw "Can't generate invoice";
        try{
            const out = await this.decodeInvoice(invoice);
            return out;
        }catch(e){
            throw "Can't decode invoice "+e;
        }
    }
}