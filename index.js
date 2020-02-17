"use strict";
const { app, BrowserWindow, dialog, ipcMain, shell, clipboard } = require("electron");
const process = require("process");
const fs = require("fs").promises;
const assert = require("assert");
const querystring = require("querystring");
const path = require("path");
const childProcess = require("child_process");
const util = require("util");
const pEvent = require("p-event");
const Store = require('electron-store');
const store = new Store();

require("electron-unhandled")({
	showDialog: true,
	logger: (...args)=>{
		console.error(...args);
		app.quit();
	}
});

const defaultSettings = require("./static/defaultSettings.js");
const schema = require("./static/settingsSchema.js");

//writeSettings and loadSettings for settings management
const loadSettings = async ()=>{
	let settings;
	try{
		//Load Settings
		settings = store.get("settings");
		console.log(settings);
		//Test for undefined or null
		if(typeof settings === "undefined"){
			throw new Error("Settings was undefined");
		} else if(settings === null){
			throw new Error("Settings was null");
		} else if(!(settings)){
			throw new Error("Settings was falsy");
		}
		//Load schema and test
		const Validator = require("jsonschema").Validator;
		let settingsValidator = new Validator();
		settingsValidator.addSchema(schema,"/SMWCentralPlayerSettingsSchema");
		const result = settingsValidator.validate(settings,schema);
		if(result.errors.length > 0){
			throw result.errors[0];
		} else if (!result.valid){
			throw new Error("Settings file was not according to schema, but didn't throw any errors");
		}

	} catch (e){
		console.error(e);
		store.set("settings",defaultSettings);
	}
	console.log("Loaded Settings: " + JSON.stringify(settings));
	return settings;
}
const writeSettings = async (settings)=>{
	try{
		//Write Settings
		store.set("settings",settings);
		console.log("Written Settings: " + JSON.stringify(settings));
	} catch (e){
		await dialog.showMessageBox({
			type: "info",
			buttons: ["OK"],
			title: "SMWCentral Player",
			message: `Could not write to settings file.\nThe error was: ${e}`
		});
		throw e;
	}
}
const openSettingsGui = async (settings)=>{
	let settingsWindow = new BrowserWindow({
		center: true,
		fullscreenable: false,
		icon: "icon.png",
		autoHideMenuBar: true,
		show: false,
		title: "Settings",
		webPreferences:{
			devTools: true,
			nodeIntegration: true,
			sandbox: false,
			enableRemoteModule: true,
			javascript: true,
		}
	});
	global.windowReferences.push(settingsWindow);
	settingsWindow.loadFile("static/settings.html",{query: {"currSettings": JSON.stringify(settings)}});
	await pEvent(settingsWindow,"ready-to-show");
	settingsWindow.show();
}
const initialize = async (settings)=>{
	//returns false if initializatoin failed, settings otherwise
	while(settings.initStage !== 0){
		switch(settings.initStage){
			case 1:
				settings.initStage--;
				writeSettings(settings);
				await dialog.showMessageBox({
					type: "question",
					buttons: ["Open Settings","Exit"],
					calcelId: 0,
					defaultId: 0,
					title: "Final Step!",
					message: "The program has been successfully set up. Do you wish to go to the settings to configure this installation to your liking?",
					icon: "icon.png"
				});
				if(result.response === 0){
					await openSettingsGui(settings);
				} else {
					app.quit();
				}
				break;
			case 2:
				let result = await dialog.showMessageBox({
					type: "question",
					message: "For this program to work correctly you need a userscript plugin to be installed in your browser (Both Tampermonkey and Greasemonkey are good options), as well as this program's userscript. What do you wish to do?",
					buttons: ["Install Userscript","Skip"],
					cancelId: 1,
					defaultId: 0,
					title: "Userscript Installation",
					icon: "icon.png"
				});
				if(result.response === 1){
					return false;
				}
				const userscriptUrl = "https://github.com/AZMCode/SMWCentral-Play-From-Browser/raw/master/Userscript/userscript.user.js";
				shell.openExternal(userscriptUrl);
				clipboard.writeText(userscriptUrl);
				settings.initStage--;
				writeSettings(settings);
				result = await dialog.showMessageBox({
					type: "question",
					message: "Your default browser should be launched with the URL of the userscript to install. This should trigger a confirmation screen to install the script. In case this didn't happen, the URL to the userscript you need to install has been copied to your clipboard.",
					buttons: ["Next"],
					noLink: true,
					cancelId: 0,
					defaultId: 0,
					title: "Userscript Installation",
					icon: "icon.png"
				});
				break;
			case 3:
				await dialog.showMessageBox({
					type: "question",
					message: "Hello! Welcome to SMWCentral Play-From-Browser's setup!\nThis is a first-time configuration wizard, which will not display again once completed.",
					buttons: ["Next"],
					noLink: true,
					title: "SMWCentral Play-From-Browser OOBE",
					icon: "icon.png"
				});
				settings.initStage--;
				writeSettings(settings);
				break;
			default:
				settings.initStage--;
				break;
		}
	}
	return settings;
}

(async ()=>{
	//Wait for app to be ready
	await pEvent(app,"ready");
	//Electron Biolerplate
	global.windowReferences = [];
	app.on('window-all-closed', () => {
  		app.quit()
	});
	//Load settings
	const settings = await loadSettings();
	//Load URL cmd arguments
	const argList = process.argv.filter((arg)=>{
		return (arg.substring(0,19) === "smwcentralplayer://")
	});
	//Check if the app is called to patch'a ROM
	if(argList.length === 1){
		//What the app does if it is time to patch'a ROM
		let initialized = false;
		if(settings.initStage !== 0){
			if(await initialize(settings) === true){
				initialized = true;
			}
		} else {
			initialized = true;
		}
		if(initialized){
			//Parse Arguments
			const query = argList[0].substring(19,argList[0].length);
			const details = querystring.parse(query);
			console.dir(details);
			Object.keys(details).every((elm)=>{
				return ["id","type","name"].indexOf(elm) >= 0
			});
			Object.values(details).every((elm)=>{
				//Checks if details were not declared twice
				return (typeof elm === "string");
			});
			//Check for game availability
			if(settings[details.type.toLowerCase()].enabled !== true){
				await dialog.showMessageBox({
					type: "info",
					buttons: ["OK"],
					title: "SMWCentral Player",
					message: `The rom type ${details.type} is not currently enabled in settings or supported`
				});
				return;
			}
			//Download Patch
			const patchFileResponse = await require("request-promise-any")({encoding: null, url:`https://dl.smwcentral.net/${details.id}/`});
			const sanitizedZipFilename = require("sanitize-filename")(details.name + ".zip","_");
			const sanitizedFolderName = require("sanitize-filename")(details.name,"_");
			const patchPath = path.resolve(settings[details.type.toLowerCase()].patch_files_storage,sanitizedFolderName);
			const savePath = path.resolve(patchPath,sanitizedZipFilename);
			//Extract patch
			try{
				await fs.mkdir(patchPath);
			} catch(e) {
				//Meh, folder already exists innit? great thing...
			}
			fs.writeFile(savePath,patchFileResponse);
			await util.promisify(require("extract-zip"))(savePath,{dir: patchPath});
			//Find patch file
			const extractedFiles = await fs.readdir(patchPath);
			let patchFilename = undefined;
			console.dir(extractedFiles)
			for(let i = 0; i<extractedFiles.length;i++){
				const filename = extractedFiles[i];
				if(filename.slice(-4) === ".bps"){
					patchFilename = filename;
					break;
				}
			}
			if(typeof patchFilename === "undefined"){
				throw new Error("No .bps file was found inside the zip file");
			}
			//Patch File
			const bpsFile = await fs.readFile(path.resolve(patchPath,patchFilename),{encoding:null});
			const romFile = await fs.readFile(settings[details.type.toLowerCase()].original_rom,{encoding:null});
			const patchedRom = applyBps(romFile,bpsFile);
			//Get rom file extension
			const romExt = path.parse(settings[details.type.toLowerCase()].original_rom).ext;
			//Write patched rom to folder
			const patchedRomPath = path.resolve(settings[details.type.toLowerCase()].finished_files_storage,sanitizedFolderName + romExt);
			await fs.writeFile(patchedRomPath,patchedRom);
			//Run
			const execArgs = settings[details.type.toLowerCase()].emulator_args.map((arg)=>{
				return arg.replace("%ROM",patchedRomPath);
			});
			const execPath = settings[details.type.toLowerCase()].emulator_path;
			require("cross-spawn").sync(execPath,execArgs);
		}
	} else if(argList.length === 0){
		//What the app does if it isn't being used to patch'a ROM
		//Prepare ipc hooks
		ipcMain.handle("settings.write-settings",async (event,arg)=>{
			try{
				const newSettings = JSON.parse(arg);
				await writeSettings(newSettings);
				return true;
			} catch (e) {
				return e.toString() + "\n" +e.stack;
				throw e;
			}
		});
		ipcMain.handle("settings.select-dialog",async (event,arg)=>{
			//Arg is an object as such
			//{title: "Optional Title",
			//isFileDialog: true/false,
			//filters: <FileFilter[], required if isFileDialog is true>}
			let options = {properties: ["createDirectory","promptToCreate","dontAddToRecent"]};
			if(arg.title === ""){
				arg.title = undefined;
			}
			if(typeof arg.title !== "undefined"){
				options = {...options,title: arg.title};
			}
			if(arg.isFileDialog){
				options.properties.push("openFile");
				if(typeof arg.filters === "undefined"){
					throw new Error("The 'filters' argument is required if isFileDialog is true");
				}
			} else {
				options.properties.push("openDirectory");
			}
			const result = await dialog.showOpenDialog(options);
			if(result.canceled || (result.filePaths.length < 1)){
				throw new Error("dialog.showOpenDialog didn't return as expected");
			}
			return result.filePaths[0];
		});
		//Sets app as default handler
		app.setAsDefaultProtocolClient("smwcentralplayer");
		//Initialize if necessary
		let initialized = false;
		if(settings.initStage !== 0){
			if(await initialize(settings) === true){
				initialized = true;
			}
		} else {
			initialized = true;
		}
		if(initialized){
			await openSettingsGui(settings);
		}

	} else {
		throw new Error("Multiple URL's passed. Crashing");
	}
})().then(async (res,e)=>{
	if(e){
		await dialog.showMessageBox({
			title: "SMWCentral Player - Promise Error!",
			type: "error",
			message: `The program failed with an unhandled promise exception.\nPlease share this message with the developer to fix the issue:`,
			detail: e.stack.toString(),
			cancelId: 0,
			noLink: true,
			buttons: ["Exit"]
		});
	}
	if(global.windowReferences.length > 0){
		console.log("Not force-quitting because windows have been activated");
	} else {
		app.quit();
	}
});
