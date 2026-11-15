import {execFileSync} from 'node:child_process';
import {mkdir,cp,copyFile} from 'node:fs/promises';
import path from 'node:path';
await mkdir('dist',{recursive:true});
const common=['-O','-module-cache-path',path.resolve('dist/pofi-module-cache')];
const sources=['HafizlikTakip.swift','RotaExport.swift','SportAssetBridge.swift','SportFileExport.swift','SportVideoPlayer.swift','RotaPhoneInstall.swift','RotaCloudBridge.swift','RotaTextRecognition.swift','RotaPofiBridge.swift'];
execFileSync('/usr/bin/xcrun',['swiftc',...common,'-framework','AppKit','-framework','WebKit','-framework','PDFKit',...sources,'-o','dist/Rota'],{stdio:'inherit'});
const helper='dist/RotaPofi.app/Contents';
await mkdir(helper+'/MacOS',{recursive:true});await mkdir(helper+'/Resources',{recursive:true});
execFileSync('/usr/bin/xcrun',['swiftc',...common,'-framework','AppKit','-framework','WebKit','-framework','UserNotifications','-parse-as-library','PofiHelper.swift','PofiReducer.swift','PofiReminderPlan.swift','PofiAutomatic.swift','-o',helper+'/MacOS/RotaPofi'],{stdio:'inherit'});
await copyFile('Pofi-Info.plist',helper+'/Info.plist');
for(const file of ['pofi-native.js','pofi-alert.wav'])await copyFile(file,helper+'/Resources/'+file);
await cp('pofi-web',helper+'/Resources/pofi-web',{recursive:true});
execFileSync('/usr/bin/codesign',['--force','--deep','--sign','-','dist/RotaPofi.app'],{stdio:'inherit'});

