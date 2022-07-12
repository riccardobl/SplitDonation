//@ts-check
import Utils from './Utils.js';
import fetch from 'node-fetch';
import {Headers as FetchHeaders} from 'node-fetch';
import Database from "./Database.js";
import Module from './Module.js';
import Sane from '../common/Sane.js';
import Fs from 'fs/promises';
import Jwt from 'jsonwebtoken';

/**
 * @callback ErrorCallback
 * @param {any} error
 * @return {Promise<void>} 
 */
/**
 * @callback FetchPageCallback
 * @param {any} page
 * @return {Promise<boolean>} 
 */
export default class GithubModule extends Module{
   
    /**
     * 
     * @param {Database} cache 
     * @param {number} cooldown 
     * @param {number} purgeDailyLogAfterDays 
     * @param {[string]} configKeys
     * @param {string} authData 
     */

    constructor(cache, cooldown, purgeDailyLogAfterDays, configKeys, authData) {
        super();
         /**
         * @type {Database}
         * @private
         */
        this.cache = cache;
        /**
         * @type {number}
         * @private
         */
        this.cooldown = cooldown ;
        /**
         * @type {string}
         * @private
         */
        this.authData = authData;

        /**
         * @type {number}
         * @private
         */
        this.lastGithubFetch = 0;
        /**
         * @type {[string]}
         * @private
         */
        this.configKeys = configKeys;
        /**
         * @type {number}
         * @private
         */
        this.purgeDailyLogAfterDays = purgeDailyLogAfterDays;


     
    }

    async register(apiProvider) {
        this.apiProvider=apiProvider;
        this.apiProvider.registerApi("github/repo/topcontributors",async (data)=>{
            const repoName = data.repo;
            const orgName = data.org;
            const timeRangeDays = data.daysRange;
            return {
                members:await this.getPayableContributors(orgName,repoName,timeRangeDays)
            }
        });          
        this.apiProvider.registerApi("github/team",async (data)=>{
            const orgName = data.org;
            const teamId = data.team;
            return {
                members:await this.getPayableTeamMembers(orgName,teamId)
            }
        });
    }


    /**
     * @public
     * @param {any} data targets
     * @returns {Promise<void>}
     */
    async setAutoRefresh(data){
        if (this.autoRefreshInterval) clearTimeout(this.autoRefreshInterval);
        const loop = async () => {
            try {
                console.log("Synching with github");
                for (const d of data) {
                    if (d.type == "github-repo") {
                        const org = d.org;
                        for (const repo of d.repos) {
                            console.log("Synching", org, repo);
                            await this.getPayableContributors(org, repo);
                        }
                    }
                }
                console.log("Synch completed");
            } catch (e) {
                console.error(e);
            }
            this.autoRefreshInterval = setTimeout(() => loop(), 18000 * 1000);
        }
        loop();
    }

     /**
     * @private
     * @param {string} url 
     * @param {any} [postData]
     * @param {boolean} [publicApi]
     * @returns {Promise<any>}
     */
    async fetch(url, postData,publicApi){
        if(this.authData.startsWith("app:")){
            const [,appId,clientId,clientSecret,...privateKey]=this.authData.split(":");
            this.appId=appId;
            this.appPrivateKey=privateKey.join(":");
            this.clientId=clientId;
            this.clientSecret=clientSecret;

            if(this.appPrivateKey.startsWith("file://")){
                this.appPrivateKey = await Fs.readFile(this.appPrivateKey.substring("file://".length),{encoding:"utf-8"});
            }
        }
        let out = null;
        while (true) {
            await Utils.sleep(this.cooldown - (Date.now() - this.lastGithubFetch));
            const headers =  new FetchHeaders();

            if (! this.appId) {
                headers.set("Authorization", 'Basic ' + Buffer.from( this.authData, "utf-8").toString("base64"));
            }else{
                if(!publicApi){
                    const payload = {
                        iat: Math.floor(Date.now() / 1000) - 60, 
                        exp: Math.floor(Date.now() / 1000) + 60 * 5, 
                        iss:  this.appId 
                    };
                    const token=Jwt.sign(payload,  this.appPrivateKey, {algorithm: 'RS256'});

                    const headers2= new FetchHeaders();
                    headers2.set("Authorization", 'Bearer ' +token);
                    headers2.set("Accept", "application/vnd.github.v3+json");

                    const /**@type {any}*/ installations = await fetch("https://api.github.com/app/installations", {headers: headers2}).then(res=>res.json());

                    const installationId=installations[0].id;
                    if(isNaN(installationId))throw "Wrong installation id";
                    
                    const /**@type {any}*/ accessToken = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {method:"POST",headers: headers2}).then(res=>res.json());
                                
                    headers.set("Authorization", 'token ' + accessToken.token );
                }else{
                    headers.set("Authorization", 'Basic ' + Buffer.from( `${this.clientId}:${this.clientSecret}`, "utf-8").toString("base64"));
                }
            }

            headers.set("Accept", "application/vnd.github.v3+json");
            out = await fetch(url, {
                method: postData ? "POST" : "GET",
                body: postData,
                headers: headers
            }).then(async res => {
                if (res.status == 202) {//uncached?
                    try {
                        console.log(await res.text());
                    } catch (e) { }
                    return null;
                } else return res.text();
            });
            this.lastGithubFetch = Date.now();
            if (out != null) break;
        }

        return out;
    }

    /**
     * @private
     * @param {string} url 
     * @param {Object<string,any>} [postData]
     * @param {ErrorCallback} [onError] 
     * @param {boolean} [publicApi] 
     * @returns {Promise<any>}
     */
    async fetchJSON(url, postData, onError,publicApi) {
        const out = JSON.parse(await this.fetch(url, postData,publicApi));
        if (out.message) {
            if (onError) await onError(out);
            throw out.message;
        }
        return out;
    }

     /**
     * @private
     * @param {string} url 
     * @param {Object<string,any>} [postData]
     * @param {FetchPageCallback} [callback] 
     * @param {ErrorCallback} [onError] 
     * @param {boolean} [publicApi]
     * @returns {Promise<any>}
     */
    async fetchMultiPageJSON(url, postData, callback, onError,publicApi) {
        const pages = [];
        let pageId = 1;
        while (true) {
            const fullUrl = `${url}?page=${pageId}`;
            const page = await this.fetchJSON(fullUrl, postData, onError,publicApi);
            if (page.length == 0) break;
            else {
                if (callback) {
                    if (await callback(page)) break;
                }
                pages.push(page);
            }
            pageId++;
        }
        return pages;
    }


    /**
     * @private
     * @param {string} login 
     * @returns {Promise<Object<string,*>>}
     */
    async getUser(login) {
        const userData =  await this.cache.getOrSet(`github-user-${login}`, async (key) => {
            const userData = await this.fetchJSON(`https://api.github.com/users/${login}`,undefined,undefined,true);
            try{
                const readmeData = await this.fetchJSON(`https://api.github.com/repos/${login}/${login}/readme`,undefined,undefined,true);
                const readmeContent = await this.fetch(readmeData.download_url,undefined,true);
                userData.readme=readmeContent;
            }catch(e){
                // console.log(e);
                // userData.readme=e;
            }
            return userData;
        }, 86400000);
        const out={};
        out.login=Sane.str(userData.login,{f:/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i});
        out.name=Sane.str(userData.name,{html:false});
        out.bio=Sane.str(userData.bio,{html:false});
        out.readme=Sane.str(userData.readme,{html:false});
        return out;
    }


    // static async getGistsList(login){
    //     return this.cache.getOrSet(`gists-${login}`,async (key)=>{
    //         const gists=[];
    //         const pages=await this.fetchMultiPageJSON(`https://api.github.com/users/${login}/gists`);
    //         for(const page of pages){
    //             for(const gist of page){
    //                 gists.push(gist);
    //             }
    //         }
    //         return gists;
    //     },86400000);
    // }

    // static async getGist(gistUrl){
    //     return this.cache.getOrSet(`gist-${gistUrl}`,async (key)=>{
    //         return this.fetch(gistUrl);
    //     },86400000);
    // }

    

     /**
     * @private
     * @param {string} login 
     * @returns {Promise<string>}
     */
    async getPaymentAddress(login) {
        // get cached pay address if it exists
        return await this.cache.getOrSet("github-payAddress-" + login, async (key) => {

            // find gist config file if exists
            /** @type {any}*/
            let userConfig = undefined;
            await this.fetchMultiPageJSON(`https://api.github.com/users/${login}/gists`, undefined, /**@type {FetchPageCallback}*/async (gists) => {
                for (const gist of gists) {
                    for (const [filename, filedata] of Object.entries(gist.files) ) {
                        if (this.configKeys.indexOf(filename)!=-1) { // find by filename
                            try {
                                const rawUrl=filedata.raw_url;
                                if(!rawUrl.startsWith(`https://gist.githubusercontent.com/${login}/`)) throw "Invalid raw url "+rawUrl;
                                userConfig = JSON.parse(await this.fetch(rawUrl,undefined,true)); // fetch gist content
                                return true;
                            } catch (e) {
                                console.log(e);
                            }
                        }
                    }
                }
                return false;
            },undefined,true);

            let paymentAddress = null;
            // use gist config to detect if the user wants to receive payments and on which address
            if (userConfig && userConfig.enabled) paymentAddress = userConfig.addr;

            // if payments are NOT disabled and the address is not specified on the gist config, 
            // try to find a lighting address in the bio by searching for ⚡name@domain.tld
            if (!paymentAddress && (!userConfig || userConfig.enabled)) {
                // console.info("Look for payment info in user bio for", login);
                const userData = await this.getUser(login);
                paymentAddress = await Utils.findLightningAddress(userData.bio);
                if(!paymentAddress) paymentAddress = await Utils.findLightningAddress(userData.readme);
                // paymentAddress = /\u26A1([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/ig.exec(userData.bio);
                // if(paymentAddress){
                //     paymentAddress=/\u26A1([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/ig.exec(userData.readme);
                // }
                // if (paymentAddress) paymentAddress = paymentAddress[1];
            }

            paymentAddress = paymentAddress?Sane.str(paymentAddress,{f:/[A-Za-z .@/:0-9_\\-]+$/g}):undefined;

            return paymentAddress;
        }, 86400000);

    }

    /**
     * @private
     * @param {string} org 
     * @param {string} team 
     * @returns {Promise<string[]>}
     */
    async getPayableTeamMembers(org, team) {
        if (!org || !team) throw "Organization or team not defined";
        return this.cache.getOrSet(`github-org-${org}-members-${team}`, async (key) => {
            const out = [];
            const teamData = await this.fetchJSON(`https://api.github.com/orgs/${org}/teams/${team}`, undefined, async (err) => {
                if (err.message == "Not Found") {
                    console.error(`
Can't access team api for ${org} - ${team}. 
Please configure githubClientId and githubClientSecret to use an access token with scope 
    read:org 
generated by an user with reading access to the organization's teams 
                `);
                }
            });
            const orgId=Sane.str(teamData.organization.id,{f:"[A-Za-z0-9\\_\\-\\.]+"});
            const teamId=Sane.str(teamData.id,{f:"[A-Za-z0-9\\_\\-\\.]+"});
            const memberPages = await this.fetchMultiPageJSON(`https://api.github.com/organizations/${orgId}/team/${teamId}/members`);
            for (const memberPage of memberPages) {
                for (const member of memberPage) {
                    const payAddr = await this.getPaymentAddress(member.login);
                    if (payAddr) {
                        const v={};
                        v.name=Sane.str(member.login,{f:/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i});
                        v.addr = payAddr;
                        out.push(v);
                    }
                }
            }
            return out;
        });
    }

    
    /**
     * @private
     * @param {string} org 
     * @param {string} repo 
     * @param {number} [timeframeDays]
     * @returns {Promise<any>}
     */
    async getPayableContributors(org, repo, timeframeDays) {
        if (!timeframeDays) {
            return this.cache.getOrSet(`github-contributors-${repo}`, async (key) => {
                const contributors = [];
                // fetch all contributors
                await this.fetchMultiPageJSON(`https://api.github.com/repos/${org}/${repo}/contributors`, undefined, async (page) => {
                    for (const contributor of page) {
                        try {
                            const out={};
                            out.name=Sane.str(contributor.login,{f:/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i});
                            out.addr = await this.getPaymentAddress( out.name);
                            out.contributions=Sane.int( contributor.contributions);
                            // skip if contributor doesn't have a payment address
                            // if(contributorData.addr){ 
                            if ( out.addr ) {
                                console.info("Add ", out);
                                contributors.push(out);
                            }
                        } catch (exc) {
                            console.error("Error parsing contributor", contributor);
                            console.error(exc);
                        }
                    }
                    return false;
                });
                contributors.sort((a, b) => b.contributions - a.contributions);
                return contributors;
            }, 86400000);
        } else {
            if (!Number.isInteger(timeframeDays)) throw "TimeFrame should be an integer.";
            return this.cache.getOrSet(`github-contributors-${repo}-delta-${timeframeDays}`, async (key) => {
                const contributorsDelta = [];
                const contributors = await this.getPayableContributors(org, repo,  undefined);

                for (const contributor of contributors) {
                    // Compute delta
                    const logKey = `contributor-${repo}-${contributor.name}-log`;
                    // Get log from cache or initialize to empty if doesn't exist
                    const contributorLog = await this.cache.getOrSet(logKey, async (key) => { return { timestamp: Date.now(), daily: [] } });

                    // Add current values if one day has been passed from last insertion
                    if (contributorLog.daily == 0 || Date.now() - contributorLog.timestamp >= 86400000) {
                        contributorLog.timestamp = Date.now(); // update timestamp
                        contributorLog.daily.push(contributor); // add current day
                        if (contributorLog.daily.length > this.purgeDailyLogAfterDays) { // purge old data
                            contributorLog.daily.splice(0, contributorLog.daily.length - this.purgeDailyLogAfterDays);
                        }
                        await this.cache.set(logKey, contributorLog); // Update log 
                    }

                    // get first day of time range
                    const firstDay = contributorLog.daily.length <= timeframeDays ?
                        contributorLog.daily[0] : contributorLog.daily[contributorLog.daily.length - timeframeDays];

                    // calculate delta
                    if (firstDay) contributor.contributions -= firstDay.contributions;

                    // add to results
                    contributorsDelta.push(contributor);
                }
                contributorsDelta.sort((a, b) => b.contributions - a.contributions);
                return contributorsDelta;
            });
        }
    }
}
