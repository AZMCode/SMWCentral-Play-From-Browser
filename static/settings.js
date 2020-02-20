window.onload = async ()=>{
	const invoke = require("electron").ipcRenderer.invoke;
	function getElementsByName(parent,name){
		name = encodeURI(name);
		const elements = parent.querySelectorAll(`[name=${CSS.escape(name)}]`);
		return [...elements];
	}
	const sectionNameMapping = {
		"smw" : "Super Mario World",
		"sm64": "Super Mario 64"   ,
		"yi"  : "Yoshi's Island"
	};
	//Create game divs
	const containerDivs = [];
	for(game in sectionNameMapping){
		let gameDiv = document.createElement("div");
		gameDiv.id = game;
		gameDiv.className = "game-settings-container";
		document.getElementById("game-containers").appendChild(gameDiv);
		containerDivs.push(gameDiv);
	}
	//Set up input forms
	const template = document.getElementById("game-template");
	let containers = document.getElementsByClassName("game-settings-container");
	let enabledCheckboxes = [];
	for(section of containers){
		//Clone and customize Forms
		let sectionSettings = template.cloneNode(true);
		//Change form id
		sectionSettings.id = `${section.id}-settings`;
		//Get CSS classes of new form, filter out the "template" class, then reapply
		{
			const templateClasses = sectionSettings.className.split(" ");
			const sectionClasses = templateClasses.filter((s)=>{return (s !== "template")});
			sectionSettings.className = sectionClasses.join(" ");
		}
		//Append new form to document
		section.appendChild(sectionSettings);
		//Get the new named title element and give it its proper innerText
		{
			let sectionTitle = getElementsByName(sectionSettings,"title")[0];
			sectionTitle.innerText = sectionNameMapping[section.id];
		}
		//Get the new named enable checkbox element, and the respective content div and save it in the enabledCheckboxes Array
		{
			const sectionCheckbox = getElementsByName(sectionSettings,"enabled")[0];
			const sectionContentDiv = getElementsByName(sectionSettings,"contents")[0];
			enabledCheckboxes.push({
				checkbox: sectionCheckbox,
				contents: sectionContentDiv,
				id: section.id,
				prevValue: undefined
			});
		}
	}
	//Load settings' current values
	const settingsJSON = (new URLSearchParams(window.location.search)).get("currSettings");
	let settings = JSON.parse(settingsJSON);
	console.dir(settings);
	//Set values to form elements
	for(div of containerDivs){
		const gameSettings = settings[div.id];
		//Set "enabled" checkbox
		getElementsByName(div,"enabled")[0].checked = gameSettings.enabled;
		//Set string values
		getElementsByName(div,	"patch_files_storage"	)[0]	.value = gameSettings.patch_files_storage	;
		getElementsByName(div,	"finished_files_storage")[0]	.value = gameSettings.finished_files_storage;
		getElementsByName(div,	"original_rom"			)[0]	.value = gameSettings.original_rom			;
		getElementsByName(div,	"emulator_path"			)[0]	.value = gameSettings.emulator_path			;
		//Set emulator_args value
		getElementsByName(div,"emulator_args")[0].value = gameSettings.emulator_args.join("\n");
	}
	//Listeners for switching of Enabled Checkboxes
	enabledCheckboxes.forEach((details)=>{
		const checkboxListener = ()=>{
			if(details.checkbox.checked !== details.prevValue){
				details.prevValue = details.checkbox.checked;
				if(details.prevValue){
					//Fetch .contents classes, and remove all "hidden" classes
					let classes = details.contents.className.split(" ");
					classes = classes.filter((elm)=>{return (elm !== "hidden")});
					details.contents.className = classes.join(" ");
				} else {
					//Fetch .contents classes, and make sure only 1 "hidden" class is named
					let classes = details.contents.className.split(" ");
					classes = classes.filter((elm)=>{return (elm !== "hidden")});
					classes.push("hidden");
					details.contents.className = classes.join(" ");
				}
			}
		}
		//Run once at start to ensure correct initial state
		checkboxListener();
		details.checkbox.addEventListener("input",checkboxListener,);
	});
	//Add file browser handlers
	containerDivs.forEach((div)=>{
		const fileBrowsers = [...div.querySelectorAll("[name$=fileBrowse]")];
		const folderBrowsers = [...div.querySelectorAll("[name$=folderBrowse]")];
		let allBrowsers = [];
		allBrowsers.push(fileBrowsers.map(
			(elm)=>{
				return {type:"file",elm: elm}
			}
		));
		allBrowsers.push(folderBrowsers.map(
			(elm)=>{
				return {type:"folder",elm: elm}
			}
		));
		allBrowsers = allBrowsers.flat();
		allBrowsers.forEach((browser)=>{
			console.assert(browser.type === "file" || browser.type === "folder",new Error("browser.type should only be either 'file' or 'folder'"));
			browser.elm.addEventListener("click",async ()=>{
				const fileMappings = {
					"original_rom.fileBrowse" : {
						title: "Select unpatched ROM",
						filters:[{name:"Original ROM", extensions:["*"]}]
					},
					"emulator_path.fileBrowse" : {
						title: "Select your preferred emulator executable",
						filters: [{name:"Emulator Executable", extensions:["exe","*"]}]
					}
				}
				const browserName = browser.elm.getAttribute("name");
				const browserArgs = {...fileMappings[browserName],isFileDialog: (browser.type === "file")};
				const result = await invoke("settings.select-dialog",browserArgs);
				//Set result to search bar next to button
				if(result){
					const textField = browser.elm.parentElement.querySelectorAll(`input:not([name=${CSS.escape(browserName)}])`)[0];
					textField.value = result;
				}
			});
		});
	});
	//Add handler to apply new settings once changed
	const applyButton = document.getElementById("update-settings");
	applyButton.addEventListener("click",async ()=>{
		for(div of containerDivs){
			const gameSettings = settings[div.id];
			//Set "enabled" checkbox
			gameSettings.enabled = getElementsByName(div,"enabled")[0].checked;
			//Set string values
			gameSettings.patch_files_storage 	= getElementsByName(div,"patch_files_storage"	)[0].value;
			gameSettings.finished_files_storage = getElementsByName(div,"finished_files_storage")[0].value;
			gameSettings.original_rom 			= getElementsByName(div,"original_rom"			)[0].value;
			gameSettings.emulator_path 			= getElementsByName(div,"emulator_path"			)[0].value;
			//Set emulator_args value
			gameSettings.emulator_args = getElementsByName(div,"emulator_args")[0].value.split("\n");
		}
		const result = await invoke("settings.write-settings",JSON.stringify(settings));
		let buttonText;
		if(result === true){
			buttonText = "Settings Saved";
		} else {
			buttonText = "Error Saving";
		}
		const originalText = "Apply Settings";
		applyButton.value = buttonText;
		await new Promise((resolve)=>{setTimeout(resolve,2000)});
		applyButton.value = originalText;
	});
}
