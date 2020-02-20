//The files settingsSchema.js and defaultSettings.js are needed because getting
//the path of extraResources with electron-builder is a pain if you try
//to support multiple platforms. If you want to change it, you're welcome,
//but be warned, there lies madness.

const defaultSettings =
{
	"initStage": 3,
    "smw": {
        "enabled": false,
        "patch_files_storage": "",
        "finished_files_storage": "",
        "original_rom": "",
        "emulator_path": "",
        "emulator_args": [
            "%ROM"
        ]
    },
    "sm64": {
        "enabled": false,
        "patch_files_storage": "",
        "finished_files_storage": "",
        "original_rom": "",
        "emulator_path": "",
        "emulator_args": [
            "%ROM"
        ]
    },
    "yi": {
        "enabled": false,
        "patch_files_storage": "",
        "finished_files_storage": "",
        "original_rom": "",
        "emulator_path": "",
        "emulator_args": [
            "%ROM"
        ]
    }
};
module.exports = defaultSettings;
