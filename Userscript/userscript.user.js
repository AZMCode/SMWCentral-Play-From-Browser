// ==UserScript==
// @name SMWCentral Play-From-Browser
// @description Allows for quick playback of SMWCentral Hacks with an accompanying server program
// @match https://www.smwcentral.net/*
// @noframes
// @run-at document-idle
// @version 0.0.1
// ==/UserScript==
"use strict";
const httpReq = XMLHttpRequest;

function defer() {
	var res, rej;

	var promise = new Promise((resolve, reject) => {
		res = resolve;
		rej = reject;
	});

	promise.resolve = res;
	promise.reject = rej;

	return promise;
}


const toArray = (collection)=>{
	let output = [];
	for(var i = 0;i < collection.length;i++){
		output.push(collection[i]);
	}
	return output;
}

const findHackId = (url)=>{
	const urlId = url.match(/\/\d+\//);
	if(urlId === null){
		throw new Error("Could not parse Hack ID out of download URL");
	}
	const hackId = urlId[0].substring(1,urlId[0].length - 1);
	return hackId;
}

const findHackType = (detailsDocument)=>{
	//Find relevant piece of data
	const sectionLinkResult = document.evaluate("table/tbody/tr[8]/td/table/tbody/tr/td[1]/table/tbody/tr[2]/td[2]/table[1]/tbody/tr[2]/td/table/tbody/tr/td/a",
	detailsDocument,null,9/*Means return first node*/,null);
	const sectionLink = sectionLinkResult.singleNodeValue;
	const sectionUrl = sectionLink.href;
	const sectionString = new URLSearchParams(sectionUrl).get("s");
	//Match piece of data to possible values
	const possibleSectionValues = ["smwhacks","sm64hacks","yihacks"];
	const mappedSectionValues = ["SMW","SM64","YI"];
	const sectionID = possibleSectionValues.indexOf(sectionString);
	if(sectionID < 0){
		throw new Error("Unknown section string recovered from details page");
	}
	return mappedSectionValues[sectionID];
}
const findHackName = (detailsDocument)=>{
	const nameLinkResult = document.evaluate("table/tbody/tr[8]/td/table/tbody/tr/td[1]/table/tbody/tr[2]/td[2]/table[1]/tbody/tr[4]/td[2]/a",
	detailsDocument,null,9/*Means return first node*/,null);
	const nameLink = nameLinkResult.singleNodeValue;
	return nameLink.innerHTML;
}




const findHackDetails = async (url)=>{
	let output = {};
	//Find hack ID
	const hackId = findHackId(url);
	output.id = hackId;
	//Request details page of hack
	let load = defer();
	const typeReq = new httpReq();
	typeReq.open("GET",`https://www.smwcentral.net/?p=section&a=details&id=${hackId}`)
	typeReq.addEventListener("load",load.resolve);
	typeReq.addEventListener("error",load.reject);
	typeReq.addEventListener("abort",load.reject);
	typeReq.send();
	const response = await load;
	debugger;
	const detailsDiv = document.createElement("div");
	detailsDiv.innerHTML = response.target.response;
	//Find hack type
	const hackType = findHackType(detailsDiv);
	output.type = hackType;
	const hackName = findHackName(detailsDiv);
	output.name = hackName;
	return output;
}

(async()=>{

	const links = toArray(document.getElementsByTagName("a"));
	const downloadLinks = links.filter((elm)=>{return elm.innerHTML === "Download"});
	downloadLinks.forEach(async (elm)=>{
		elm.innerHTML = "Loading...";
		let valid = true;
		//Check if zip
		if(valid){
			if(elm.href.slice(-4) !== ".zip"){
				valid = false;
			}
		}
		//Find hack Type
		let details;
		if(valid){
			try{
				details = await findHackDetails(elm.href);
			} catch (e){
				valid = false;
				console.error(`Couldn't get hack type, skipping ${elm.href}`);
				console.error(e);
			}
		}
		//If valid replace button
		if(valid){
			let query = new URLSearchParams();
			for(const key in details){
				query.append(key,details[key]);
			}
			let playBtn = document.createElement("a");
			playBtn.setAttribute("href","smwcentralplayer://" + query.toString());
			playBtn.innerHTML = "Play";
			elm.insertAdjacentElement("afterend",playBtn);
			elm.insertAdjacentElement("afterend",document.createElement("br"));
		}
		elm.innerHTML = "Download";
	});

})().catch((e)=>{throw e});
