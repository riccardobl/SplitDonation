import Utils from './Utils.js';
import Sane from '../common/Sane.js';

export default class OpencollectiveRouter {

    static async fetchScoinBridge(action,data){
        return await new Promise((res,rej)=>{
            const loop=async ()=>{
                try{
                    const out=await Utils.fetchBackend(`/scoinbridge/${action}`,data);
                    res(out);
                }catch(e){
                    if(e=="Out of limits") setTimeout(()=>loop(),2000);
                    else rej(e);
                }
            };
            loop();
        });
        
    }
    static async getRouteStatus(target){
        const depositAddress = target.depositAddress;
        const orderId = target.orderId;
        const orderToken = target.orderToken;
        if(!orderId||!orderToken||!depositAddress||!target.scoinrouted)throw "Not a valid routed order";
        
        return await this.fetchScoinBridge("checkalive",{
            orderToken:orderToken,
            depositAddress:depositAddress,
            orderId:orderId
        });
    }


    static async createOrder(config, lndhub, collective, amountSats, email, name) {

        let ffroute=await this.fetchScoinBridge("output",{
            currency:"LTC",
            amount:amountSats
        });
          
        let amount=ffroute.amount
        const fee=(amount*config.ocRouteSlippage)/100.;
        amount-=fee;

        let currency=ffroute.currency;
        if(!amount)throw "Invalid amount";
        amount=Math.floor(amount*1000)/1000.;
        
        const account = await fetch("https://api.opencollective.com/graphql/v2", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                operationName: "GetAccountId",

                query:`query GetAccountId { 
                    account(slug: "${collective}") {    
                      id
                    }
                  }`,
                  variables: {
                  },

            })
        }).then(res=>res.json());

        const payload = JSON.stringify({
                "operationName": "CreateOrder",
                "variables": {
                    "order": {
                        "quantity": 1,
                        "amount": {
                            "valueInCents": 100
                        },
                        "frequency": "ONETIME",
                        "guestInfo": {
                            "email": Sane.str(email,{f:/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/g}),
                            "name": Sane.str(name,{f:"[A-Z a-z0-8]+"})
                        },
                        "fromAccountInfo": {
                            "location": {}
                        },
                        "toAccount": {
                            "id": Sane.str(account.data.account.id,{f:"[A-Za-z0-9\\_\\-\\.]+"})
                        },
                        "data": {
                            "thegivingblock": {
                                "pledgeAmount": Sane.float(amount),
                                "pledgeCurrency": Sane.str(currency,{f:"[A-Za-z0-9\\_\\-\\.]+"})
                            }
                        },
                        "paymentMethod": {
                            "service": "THEGIVINGBLOCK",
                            "newType": "CRYPTO"
                        },
                        "context": {
                            "isEmbed": false
                        },
                        "taxes": null
                    }
                },
                "query": "mutation CreateOrder($order: OrderCreateInput!) {\n  createOrder(order: $order) {\n    ...OrderResponseFragment\n    __typename\n  }\n}\n\nfragment OrderResponseFragment on OrderWithPayment {\n  guestToken\n  order {\n    ...OrderSuccessFragment\n    __typename\n  }\n  stripeError {\n    message\n    account\n    response\n    __typename\n  }\n  __typename\n}\n\nfragment OrderSuccessFragment on Order {\n  id\n  legacyId\n  status\n  frequency\n  data\n  amount {\n    value\n    valueInCents\n    currency\n    __typename\n  }\n  paymentMethod {\n    id\n    service\n    type\n    data\n    __typename\n  }\n  platformTipAmount {\n    value\n    valueInCents\n    currency\n    __typename\n  }\n  tier {\n    id\n    name\n    __typename\n  }\n  membership {\n    id\n    publicMessage\n    __typename\n  }\n  fromAccount {\n    id\n    name\n    ... on Individual {\n      isGuest\n      __typename\n    }\n    __typename\n  }\n  toAccount {\n    id\n    name\n    slug\n    tags\n    type\n    isHost\n    settings\n    ... on AccountWithContributions {\n      contributors(limit: 1) {\n        totalCount\n        __typename\n      }\n      __typename\n    }\n    ... on AccountWithParent {\n      parent {\n        id\n        slug\n        __typename\n      }\n      __typename\n    }\n    ... on AccountWithHost {\n      host {\n        ...OrderSuccessHostFragment\n        __typename\n      }\n      __typename\n    }\n    ... on Organization {\n      host {\n        ...OrderSuccessHostFragment\n        ... on AccountWithContributions {\n          contributors(limit: 1) {\n            totalCount\n            __typename\n          }\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n\nfragment OrderSuccessHostFragment on Host {\n  id\n  slug\n  settings\n  bankAccount {\n    id\n    name\n    data\n    type\n    __typename\n  }\n  __typename\n}"
            });
        

        const resp = await fetch("https://opencollective.com/api/graphql/v2", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: payload
        }).then(res => res.json());

        const depositAddress = Sane.str(resp.data.createOrder.order.paymentMethod.data.depositAddress,{f:"[A-Za-z0-9\\_\\-\\.]+"});
        
        ffroute=await this.fetchScoinBridge("route",{
            amount:amount,
            depositAddress:depositAddress,
            currency:"LTC"
        });
        ffroute.scoinrouted=true;
        ffroute.route=`You -> ${lndhub} -> BTCLN-LTC -> OpenCollective.com`;
        ffroute.depositAddressExplorer=`https://blockchair.com/litecoin/address/${depositAddress}`;
        return ffroute;
    }
}