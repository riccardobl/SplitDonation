import Utils from './Utils.js';
import OpencollectiveRouter from './OpencollectiveRouter.js';
import Sane from '../common/Sane.js';
export default class PaymentManager {
    static async init(config){
        this.config=config;
        this.lastFee=0;
        this.savedAccess={};
    }

    static async _call(lndhub, path, data, auth, method,retry ) {
        for (let j = 0; j < (retry?retry:10); j++) {
            if (method) method = method.toUpperCase();
            else method = "POST";
            let uri = `${lndhub}/${path}`;
            if (method == "GET" && data) {
                let params = "";
                for (const [key, value] of Object.entries(data)) {
                    if (params != "") params += "&";
                    params += key + "=" + value;
                }
                uri += "?" + params;
            }

            const options = {
                body: method == "POST" ? JSON.stringify(data) : undefined,
                method: method,
                mode: 'cors',
                headers: {
                    'Authorization': `Bearer ${auth}`,
                    'Content-Type': 'application/json'
                },
                cache: 'no-cache'
            };

            let resp = await fetch(uri, options);
            if (!Utils.isSuccessHttpCode(resp.status)) {
                await Utils.sleep(200);
                continue;
            }

            resp = await resp.text();

            resp = JSON.parse(resp, (k, v) => {
                if (
                    v !== null &&
                    typeof v === 'object' &&
                    'type' in v &&
                    v.type === 'Buffer' &&
                    'data' in v &&
                    Array.isArray(v.data)) {
                    return Utils.toHex(new Uint8Array(v.data));
                }
                return v;
            });
            if (resp == "rate limit exceeded") {
                await Utils.sleep(200);
                continue;
            }

            if (resp.error) {
                console.error(`Can't fetch ${method} ${uri} 
            ${JSON.stringify(options)}
            Response: ${JSON.stringify(resp)}`);
                throw resp.message;
            }

            return resp;
        }
        throw "Failed to fetch";
    }


    static async _auth(lndhub,user, password) {
        let savedAccess=this.savedAccess[user+":"+password];
        if(savedAccess&&((Date.now()-savedAccess.time)>1000*60*5))savedAccess=undefined;
        if(!savedAccess){
            const _performAuth = async (retry) => this._call(lndhub,`auth?type=auth`, {
                "login": user,
                "password": password
            },"","POST",retry);

            let resp;
            try {
                resp = await _performAuth(1);
            } catch (e) {
                const newUser=await this._call(lndhub,`create`, {
                    partnerid: this.config.lndhub_partnerId,
                    accounttype: this.config.lndhub_accounttype,
                    login: user,
                    password: password
                });
                if(newUser.error)throw newUser.error;
                user=newUser.login||user;
                password=newUser.password||password;                
                resp = await _performAuth(10);
            }
            
            savedAccess={
                time:Date.now(),
                token:Sane.str(resp.access_token,{f:"[A-Za-z0-9\\_\\-\\.]+"})
            }
            this.savedAccess[user+":"+password]=savedAccess;
        }
        return {
            user:user,
            password:password,
            access_token:savedAccess.token
        };
    }

    static async decodeInvoice(invoice,sats){
        if(!invoice)throw "Invoice unset";
        return Utils.fetchBackend("/decode_invoice",{
            invoice:invoice,
                sats:sats
        });
    }
    static async generateInvoice(addr,sats,message){
        if(!addr||!sats)throw "Addr or Amount unset";
        return Utils.fetchBackend("/invoice",{
                addr:addr,
                sats:sats,
                comment:message
        },6);
    }



    static async _expandTargets(targets){
        const outputTargets=[];
        for(const target of targets){
            if(!target.sats)continue;
            if(target.type=="lightning-address"||target.type=="opencollective"){
                // target.invoice=await this.generateInvoice(target.addr,target.sats,config.donationComment);
                outputTargets.push(target);
            }else if(target.type=="github-org-team"||target.type=="github-repo"){

                const subTargets=[];
                for(const el of (target.teams||target.repos)){

                    let subTargetsData;
                    if(target.type=="github-org-team"){
                        subTargetsData=(await Utils.fetchBackend("/github/team",{
                            org: target.org,
                            team:el
                        })).members;
                    }else{
                        subTargetsData=(await Utils.fetchBackend("/github/repo/topcontributors",{                        
                            repo:el,
                            org: target.org
                        })).members;
                        console.log("Fetch contributors ",subTargetsData);
                    }
                    for(const subTargetData of subTargetsData){
                        let alreadyExists=false;
                        for(const addedSubTarget of subTargets){
                            if(addedSubTarget.addr==subTargetData.addr){
                                alreadyExists=true;
                                break;
                            }
                        }
                        if(alreadyExists)continue;
                        const subTarget=await Utils.clone(target);
                        subTarget.type="lightning-address";
                        subTarget.description=target.description+": "+subTargetData.name;
                        subTarget.addr=subTargetData.addr;
                        subTargets.push(subTarget);
                    }                    
                }
                const subTargetSats=Math.floor(target.sats/subTargets.length);
                for(const subTarget of subTargets){
                    subTarget.sats=subTargetSats;
                }
                outputTargets.push(...subTargets);

            }
           
        }
        console.log(outputTargets);
        return outputTargets;
    }
    static async _generateInvoices(config,lndhub, targets,email, name, message){
        // for(const target of targets){
        await Promise.allSettled(targets.map(async target=>{
            try{
                if(target.sats<=1)return undefined;
                if(target.type=="lightning-address"){
                    let fullMessage=(target.donationComment?target.donationComment.substring(0,50):"")+(message?message:"");
                    fullMessage=fullMessage.substring(0,150);
                    target.invoice=await this.generateInvoice(target.addr,target.sats,fullMessage);
                    target.route=`You -> ${lndhub} -> Lightning Network -> ${target.addr}`;   
                }else if(target.type=="opencollective"){
                    const ocroute=await OpencollectiveRouter.createOrder(config,lndhub,target.collective,target.sats,email, name)
                    target.invoice=await this.decodeInvoice(ocroute.invoice);
                    target.depositAddress=ocroute.depositAddress;
                    target.sats=ocroute.sats;
                    target.scoinrouted=ocroute.scoinrouted;
                    target.depositAddressExplorer=ocroute.depositAddressExplorer;
                    target.orderId=ocroute.orderId;
                    target.orderToken=ocroute.orderToken;
                    target.notice=ocroute.notice;
                    target.route=ocroute.route;
                }
            }catch(e){
                target.status={
                    code:1,
                    desc:"Can't generate invoice. "+e
                }
                console.error(e);
            }
            return target;
        }));
        return targets;
    }

    static async _reduceTargets(targets){
        const outputTargets=[];
        for(const target of targets){
            if(target.type=="lightning-address"){
                if(target.sats<=0)continue;
                const existingTarget=outputTargets.find(t=>t.type==target.type&&t.addr==target.addr);
                if(existingTarget){
                    existingTarget.sats+=target.sats;
                    if(target.description){
                        if(!existingTarget.description)existingTarget.description=target.description;
                        else existingTarget.description+="<br>"+target.description;
                    }
                    if(target.donationComment) {
                        if(!existingTarget.donationComment)existingTarget.donationComment=target.donationComment;
                        else existingTarget.donationComment+=", "+target.donationComment;
                    }
                }else{
                    
                    outputTargets.push(target);
                }
            }else{
                outputTargets.push(target);
            }
        }
        return outputTargets;
    }


    static async resolveWeights(data){    
        let totalSats=data.sats;
        data.fee=(totalSats*this.config.fee)/100.;
        totalSats-=data.fee;

        for(const target of data.targets){
            const minSats=(!target.minSats||target.minSats<this.config.minSatsPerTarget)?this.config.minSatsPerTarget:target.minSats;
                let w=minSats/totalSats;
                if(w>.99)w=.99;
                if(!target.minWeight||target.minWeight<w){
                    target.computedMinWeight=w;
                }           
        }

        for(const target of data.targets){
            if(typeof target.enabled!="undefined"&&!target.enabled){
                target.weight=0;
                continue;
            }
            if(!target.weight)target.weight=0;
            if(target.weight<target.computedMinWeight)target.weight=0;
        }
        
        let weightSum=0;
        for(let target of data.targets){
            weightSum+=target.weight;
        }       
            
        
        for(const target of data.targets){
            if(!target.weight)continue;
            target.weight=Math.floor((target.weight/weightSum)*1000)/1000;
        }

        weightSum=0;
        for(let target of data.targets){
            weightSum+=target.weight;
        }      
        if(weightSum<0.98||weightSum>1)throw "Invalid weight sum "+weightSum+" but ~1 was expected" ;
            

         // Calculate sats per target
         for(const target of data.targets){
            if(!target.weight)target.sats=0;
            else target.sats=Math.floor(totalSats*target.weight);
            target.status={
                code:2,
                desc:"waiting"
            };      
        }


    }

    static async prepare(data){       
      
        // Expand targets
        data.targets=await this._expandTargets(data.targets);

        await this.resolveWeights(data);

      


        if(this.config.reduceTargets){
            // Reduce targets
            data.targets=await this._reduceTargets(data.targets);
        }

        // Generate invoices
        data.targets=await this._generateInvoices(this.config,data.lndhub||this.config.lndhub,data.targets,data.email,data.donorName,data.message);

        data.computed=true;
        return data;
    }

    static async start(data) {
        if (!data.computed) {
            throw "Call preparePayment before starting a payment";
        }
        if (data.payHash) return;
        if (!data.user || !data.password) {
            data.user = Utils.randomString();
            data.password = Utils.randomString();
            console.info("Use randomized user and password",  data.user ,  data.password);
        }

    
        const {user,password,access_token} = await this._auth(data.lndhub||this.config.lndhub,data.user, data.password);
        data.user=user;
        data.password=password;
        console.info("Obtained user and password",  data.user ,  data.password);

        let resp = await this._call(data.lndhub||this.config.lndhub,"addinvoice", {
            "amt": data.sats
        }, access_token);


        data.invoice = Sane.str(resp.pay_req || resp.payment_request,{f:"[A-Za-z0-9\\_\\-\\.]+"});
        data.payHash = Sane.str(resp.r_hash,{f:"[A-Za-z0-9\\_\\-\\.]+"});
        data.accessToken = access_token;

        return data;
    }


    static async process( data) {
        const {user,password,access_token} = await this._auth(data.lndhub||this.config.lndhub,data.user, data.password);

        const isPaid = (await this._call(data.lndhub||this.config.lndhub,"checkpayment/" + data.payHash, 
        "", access_token, "GET")).paid;
        if (!isPaid) {
            data.funded = false;
            return data;
        }
        data.funded = true;


        let complete = true;

        const outgoingTxs = (await this._call(data.lndhub||this.config.lndhub,"gettxs", undefined, access_token, "GET")).concat(await this._call(data.lndhub||this.config.lndhub,"getpending", undefined, access_token, "GET"));
        for (const target of data.targets) {
            if(!target.invoice)continue;
            let pendingTx = null;
            for (const tx of outgoingTxs) {
                if (
                    tx.payment_hash == target.invoice.payHash) {
                        pendingTx = tx;
                    break;
                }
            }
            if (!pendingTx) {
                if(!target.status )target.status = {
                    code: 2,
                    desc: "pending"
                };
                complete = false;
                console.info("Pay invoice", target.description,target.invoice);
                try {
                    const resp=await this._call(data.lndhub,"payinvoice", {
                        amount: target.invoice.sats,
                        invoice: target.invoice.invoice,
                    }, access_token, "POST");
                    if(this.lastFee<resp.payment_route.total_fees)this.lastFee=resp.payment_route.total_fees;
                    // break;
                } catch (e) {
                    target.status = {
                        code: 1,
                        desc: Sane.str(e + "",{html:false})
                    };

                }
            } else {
                console.log("Found",target.description,pendingTx);
                const isPaid = (await this._call(data.lndhub||this.config.lndhub,"checkpayment/" + target.invoice.payHash, "", access_token, "GET")).paid;
                if (isPaid) target.status = {
                    code: 0,
                    desc: "paid"
                }
                else if(target.status.code!=1) target.status = {
                    code: 1,
                    desc: "Error"
                };

            }
        }

        data.complete = complete;
        if (complete) {
            if(data.donateExtraFee){
                try{
                    const donateTo=data.donateExtraFee;
                    let sats=await this.getBalance(data);
                    sats-=this.lastFee;
                    if(sats>0){
                        console.info("Donate extra fees",donateTo);
                        const invoice=(await this.generateInvoice(donateTo,sats,"Extra fee donation")).invoice;            
                        await this._call(data.lndhub,"payinvoice",{
                            invoice:invoice,
                            amount:sats
                        },access_token,"POST");
                    }
                }catch(e){
                    console.error(e);
                }
            }
        }

        return data;
    }


    static async getBalance(data){
        const {user,password,access_token}=await this._auth(data.lndhub||this.config.lndhub,data.user,data.password);
        return Sane.int((await this._call(data.lndhub||this.config.lndhub,"balance",undefined,access_token,"GET")).BTC.AvailableBalance);
    }

    static async withdraw(data,invoice){
        const {user,password,access_token}=await this._auth(data.lndhub||this.config.lndhub,data.user,data.password);
        return await this._call(data.lndhub||this.config.lndhub,"payinvoice",{
            invoice:invoice
        },access_token,"POST");
    }
    
    
}