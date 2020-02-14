//Thanks to Alcaro for making his code Open Source!
//https://www.smwcentral.net/?p=profile&id=1686
//This code is a modified version of the one found in https://media.smwcentral.net/Alcaro/bps/
//And thus is under GPL 3.0
//Look at the LICENSE.txt file included in the root of the source code :)



//no error checking, other than BPS signature, input size/crc and JS auto checking array bounds
function applyBps(rom, patch){
	function crc32(bytes) {
		var c;
		var crcTable = [];
		for(var n =0; n < 256; n++){
			c = n;
			for(var k =0; k < 8; k++){
				c = ((c&1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
			}
			crcTable[n] = c;
		}

		var crc = 0 ^ (-1);
		for (var i = 0; i < bytes.length; i++ ) {
			crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 0xFF];
		}
		return (crc ^ (-1)) >>> 0;
	};

	var patchpos = 0;
	function u8() { return patch[patchpos++]; }
	function u32at(pos) { return (patch[pos+0]<<0 | patch[pos+1]<<8 | patch[pos+2]<<16 | patch[pos+3]<<24)>>>0; }

	function decode()
	{
		var ret = 0;
		var sh = 0;
		while (true)
		{
			var next = u8();
			ret += (next^0x80) << sh;
			if (next&0x80) return ret;
			sh += 7;
		}
	}

	function decodes()
	{
		var enc = decode();
		var ret = enc>>1;
		if (enc&1) ret=-ret;
		return ret;
	}

	if (u8()!=0x42 || u8()!=0x50 || u8()!=0x53 || u8()!=0x31) throw "not a BPS patch";
	if (decode() != rom.length) throw "wrong input file";
	if (crc32(rom) != u32at(patch.length-12)) throw "wrong input file";

	var out = new Uint8Array(decode());
	var outpos = 0;

	var metalen = decode();
	patchpos += metalen; // can't join these two, JS reads patchpos before calling decode

	var SourceRead=0;
	var TargetRead=1;
	var SourceCopy=2;
	var TargetCopy=3;

	var inreadpos = 0;
	var outreadpos = 0;

	while (patchpos < patch.length-12)
	{
		var thisinstr = decode();
		var len = (thisinstr>>2)+1;
		var action = (thisinstr&3);

		switch (action)
		{
			case SourceRead:
			{
				for (var i=0;i<len;i++)
				{
					out[outpos] = rom[outpos];
					outpos++;
				}
			}
			break;
			case TargetRead:
			{
				for (var i=0;i<len;i++)
				{
					out[outpos++] = u8();
				}
			}
			break;
			case SourceCopy:
			{
				inreadpos += decodes();
				for (var i=0;i<len;i++) out[outpos++] = rom[inreadpos++];
			}
			break;
			case TargetCopy:
			{
				outreadpos += decodes();
				for (var i=0;i<len;i++) out[outpos++] = out[outreadpos++];
			}
			break;
		}
	}

	return out;
}


function handleBps(rom, patch){
		var ret;
		try {
			ret = applyBps(new Uint8Array(rom.buffer), new Uint8Array(patch.buffer));
		} catch(e) {
			if (e === "wrong input file") {
				// maybe a headered rom? skip first 512 bytes for patching
				ret = applyBps(new Uint8Array(rom.buffer, 512, rom.length-512), new Uint8Array(patch.buffer,0,patch.length));
				// if we reached here, there were no errors, so the assumption about a headered rom was correct.
				// now re-add the 512 bytes from the original ROM to the patched one
				var tmpbuf = new Uint8Array(ret.length + 512); // create buffer large enough for rom and header
				tmpbuf.set(new Uint8Array(rom.buffer, 0, 512)); // copy header
				tmpbuf.set(ret, 512); // copy rom data
				ret = tmpbuf;
			}
			else throw e;
		}
		return Buffer.from(ret);
}
module.exports = handleBps;
