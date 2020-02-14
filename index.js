"use strict";
const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const process = require("process");
const fs = require("fs").promises;
const assert = require("assert");
const querystring = require("querystring");
const path = require("path");
const childProcess = require("child_process")
const pEvent = require("p-event");
const request = require("request-promise-any");
const sanitize = require("sanitize-filename");
const spawn = require('cross-spawn');
const util = require("util");
const extractZip = require("extract-zip");
const applyBps = require("./applyBps.js");
const Validator = require("jsonschema").Validator;
const Store = require('electron-store');
const store = new Store();
const unhandled = require('electron-unhandled');

const defaultSettings = require("./static/defaultSettings.js");
const schema = require("./static/settingsSchema.js");

unhandled({
	showDialog: true,
	logger: (...args)=>{
		console.error(...args);
		app.quit();
	}
});
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
		await dialog.showMessageBox({
			type: "info",
			buttons: ["OK"],
			title: "SMWCentral Player",
			message: `The Settings file was either corrupted or nonexistent. Creating a new one from defaults.\nThe error was: ${e}`
		});
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


(async ()=>{
	await pEvent(app,"ready");
	global.windowReferences = [];
	app.on('window-all-closed', () => {
  		app.quit()
	});
	const argList = process.argv.filter((arg)=>{
		return (arg.substring(0,19) === "smwcentralplayer://")
	});
	if(argList.length === 1){
		//What the app does if it is time to patch'a ROM
		try{
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
			//Load config
			const settings = await loadSettings();
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
			const patchFileResponse = await request({encoding: null, url:`https://dl.smwcentral.net/${details.id}/`});
			const sanitizedZipFilename = sanitize(details.name + ".zip","_");
			const sanitizedFolderName = sanitize(details.name,"_");
			const patchPath = path.resolve(settings[details.type.toLowerCase()].patch_files_storage,sanitizedFolderName);
			const savePath = path.resolve(patchPath,sanitizedZipFilename);
			//Extract patch
			try{
				await fs.mkdir(patchPath);
			} catch(e) {
				//Meh, folder already exists innit? great thing...
			}
			fs.writeFile(savePath,patchFileResponse);
			await util.promisify(extractZip)(savePath,{dir: patchPath});
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
			spawn.sync(execPath,execArgs);
		} catch(e) {
			//Show using Electron's fancy dialogs
			await dialog.showMessageBox({
				type: "error",
				buttons: ["OK"],
				title: "SMWCentral Player has crashed",
				message: `Sorry, SMWCentral Player has crashed.
If you could help the developer by sharing the following error message back to them, that'd be deeply appreciated:
${e.stack}`
			});
		}
		app.quit();
	} else {
		//What the app does if it isn't being used to patch'a ROM
		//Load Settings
		//Prepare defaultWindowSettings
		let defaultWindowSettings = {
			center: true,
			fullscreenable: false,
			icon: "icon.png",
			autoHideMenuBar: true,
			show: false,
			icon: "icon.png",
			webPreferences:{
				devTools: true,
				nodeIntegration: true,
				sandbox: false,
				enableRemoteModule: true,
				javascript: true
			}
		};
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
		//Open main window
		const dialogPromise = dialog.showMessageBox({
			type: "question",
			buttons: ["Open Settings","Exit"],
			defaultId: 1,
			title: "SMWCentral Player",
			detail: `Hello!
Welcome to SMWCentral Player
If you see any windows pop up regarding letting this program becoming a URL handler, please allow it.
If none appear, it means you're ready to go.
If this is your first time, we recommend you Open Settings and configure the program to your liking.`,
			icon: "icon.png"
		});
		//Sets app as default handler
		app.setAsDefaultProtocolClient("smwcentralplayer");
		const result = await dialogPromise;
		switch(result.response){
			case 0:
				let settingsWindow = new BrowserWindow({
					...defaultWindowSettings,
					title: "Settings"
				});
				global.windowReferences.push(settingsWindow);
				let settings = await loadSettings();
				settingsWindow.loadFile("static/settings.html",{query: {"currSettings": JSON.stringify(settings)}});
				await pEvent(settingsWindow,"ready-to-show");
				settingsWindow.show();
				break;
			case 1:
				app.quit();
			default:
				throw new Error("Dialog response ID was not expected.");
		}
	}
})().catch((e)=>{throw e});
