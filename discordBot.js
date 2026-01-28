const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const axios = require("axios");

const BOT_TOKEN = "YOUR_BOT_TOKEN";
const API = "http://127.0.0.1:3000/internal";

const client = new Client({intents:[GatewayIntentBits.Guilds]});

client.on("ready",()=>console.log("BOT ONLINE"));

client.on("interactionCreate", async i=>{
 if(!i.isButton()) return;

 const [type,id]=i.customId.split(":");

 if(type==="APPROVE_BANK"){
   await axios.post(API+"/approveBank",{id});
   await i.update({content:"✅ ĐÃ DUYỆT BANK",components:[]});
 }

 if(type==="REJECT_BANK"){
   await axios.post(API+"/rejectBank",{id});
   await i.update({content:"❌ ĐÃ TỪ CHỐI",components:[]});
 }
});

client.login(BOT_TOKEN);
const row = new ActionRowBuilder().addComponents(
 new ButtonBuilder().setLabel("DUYỆT").setStyle(ButtonStyle.Success).setCustomId("APPROVE_BANK:"+id),
 new ButtonBuilder().setLabel("TỪ CHỐI").setStyle(ButtonStyle.Danger).setCustomId("REJECT_BANK:"+id)
);

channel.send({content:`💳 NẠP BANK\nUser: ${user}\n💰 ${amount}`,components:[row]});
