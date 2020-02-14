//The files settingsSchema.js and defaultSettings.js are needed because getting
//the path of extraResources with electron-builder is a pain if you try
//to support multiple platforms. If you want to change it, you're welcome,
//but be warned, there lies madness.


const settingsSchema =
{
	"$schema": "http://json-schema.org/draft-07/schema#",
	"id": "/SMWCentralPlayerSettingsSchema",
	"definitions":{
		"storageFolder":{
			"title": "Folder for Storage",
			"type": "string",
			"examples": [
				"C:\\Users\\MyUser\\Folder\\",
				"/home/user/folder/"
			],
			"default": ""
		},
		"gameConfig":{
			"type": "object",
			"required": [
				"enabled",
				"patch_files_storage",
				"finished_files_storage",
				"original_rom",
				"emulator_path",
				"emulator_args"
			],
			"properties":{
				"enabled":{
					"type": "boolean",
					"title": "Whether this Game is enabled",
					"default": false,
					"examples": [false,true]
				},
				"patch_files_storage":{
					"$ref": "/SMWCentralPlayerSettingsSchema#/definitions/storageFolder"
				},
				"finished_files_storage":{
					"$ref": "/SMWCentralPlayerSettingsSchema#/definitions/storageFolder"
				},
				"original_rom":{
					"type": "string",
					"title": "Where the original ROM is located",
					"examples": [
						"C:\\Users\\MyUser\\GameRoms\\Super Mario World.smc",
						"/home/myuser/games/Super Mario World.smc"
					],
					"default": ""
				},
				"emulator_path":{
					"type": "string",
					"title": "Where the Emulator Executable is located",
					"examples": [
						"C:\\Program Files\\Emulator\\executable.exe",
						"/usr/bin/emulatorexec"
					],
					"default":""
				},
				"emulator_args":{
					"type": "array",
					"minItems": 1,
					"items": {
        				"type": "string",
						"examples": [
							"%ROM",
							"-L",
							"--fullscreen"
						]
          			},
					"default":["%ROM"]
				}
			}

		}
	},
	"type": "object",
	"required": ["smw", "sm64", "yi"],
	"properties":{
		"smw" : {"$ref": "/SMWCentralPlayerSettingsSchema#/definitions/gameConfig"},
		"sm64": {"$ref": "/SMWCentralPlayerSettingsSchema#/definitions/gameConfig"},
		"yi"  : {"$ref": "/SMWCentralPlayerSettingsSchema#/definitions/gameConfig"}
	}
}
module.exports = settingsSchema;
