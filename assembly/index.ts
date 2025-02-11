import { neo4j, http } from "@hypermode/modus-sdk-as";
import { Message, Author, MessageReference, Attachment, Guild, Channel } from "./classes";
import * as console from "as-console";

import { JSON } from "json-as";
import { DiscordRaw } from "./discord_raw";
import { Discord } from "./discord";
import { DRAG } from "./discord_rag";
import { GraphRAG } from "./graph_rag";
import { getMatches } from "./records";
export { Discord, DiscordRaw, DRAG, getMatches, GraphRAG }

export function Discord2Neo(channel_id: string): string {
  const response = Discord(channel_id);

  for (let i = 0; i < response.length; i++) {
    const prompt = response[i].content;
    const author = response[i].author;
    const type = response[i].type;
    const timestamp = response[i].timestamp;
    const id = response[i].id;
    const message_reference = response[i].message_reference;
    
    //const attachments = response[i].attachments; console.log(JSON.stringify(attachments));
    const attachments = mapAttachments(response[i].attachments); //console.log(JSON.stringify(attachments));

    addMessage(prompt, author, type, timestamp, id, channel_id, message_reference, attachments);
  }

  return 'OK'
}

const mapAttachments = (arr: Attachment[]): string[] => {
  let attachments: string[] = []

  for (let i = 0; i < arr.length; i++) {
    const url = arr[i].url;
    attachments.push(url)
  }
  return attachments
}

export function addMessage(content: string, author: Author, type: i8, timestamp: string, id: string, channel_id: string, message_reference: MessageReference, attachments: string[]): Message {
  const global_name = author.global_name;
  const username = author.username;
  const message_id = message_reference.message_id;
  
  const query = `
  MERGE (n:Message {content: $content, global_name: $global_name, username: $username, type: $type, timestamp: $timestamp, id: $id, channel_id: $channel_id, ref_id: $ref_id, attachments: $attachments})
  MERGE (m:Channel {id: $channel_id})
  MERGE (n)-[:IN]->(m)`
  
  const vars = new neo4j.Variables();
  vars.set("content", content);
  vars.set("global_name", global_name);
  vars.set("username", username);
  vars.set("type", type);
  vars.set("timestamp", timestamp);
  vars.set("id", id);
  vars.set("channel_id", channel_id);
  vars.set("ref_id", message_id);
  vars.set("attachments", attachments);
  const result = neo4j.executeQuery('neo4j', query, vars);
  /* const record = result.Records[0]; */
  /* const node = record.getValue<neo4j.Node>('n'); */

  const author2 = new Author(username, global_name)
  const message_reference2 = new MessageReference(message_id);
  let attachments2: Attachment[] = []
  
  for (let i = 0; i < attachments.length; i++) {
    const url = attachments[i];
    attachments2.push(new Attachment(url))
  }
  const message = new Message(content, author2, type, timestamp, id, channel_id, message_reference2, attachments2);

  return message;
}

export function DiscordGuilds(): Guild[] {
  const url = `https://discord.com/api/v10/users/@me/guilds`

  const response = http.fetch(url)
  //const data = response.json<JSON.Raw>(); console.log(data);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch data. Received: ${response.status} ${response.statusText}`,
    );
  }

  return response.json<Guild[]>()
}

export function guilds2Neo(): string {
  const response = DiscordGuilds();

  for (let i = 0; i < response.length; i++) { console.log(response[i].name);
    const id = response[i].id;
    const icon = response[i].icon;
    const name = response[i].name;

    addGuild(id, icon, name);
  }

  return 'OK'
}

export function addGuild(id: string, icon: string, name: string  ): Guild {
  const query = "MERGE (n:Guild {id: $id, icon: $icon, name: $name}) RETURN n;"
  const vars = new neo4j.Variables();
  vars.set("id", id);
  vars.set("icon", icon);
  vars.set("name", name);
  const result = neo4j.executeQuery('neo4j', query, vars);
  const record = result.Records[0];
  const node = record.getValue<neo4j.Node>('n');

  const guild = new Guild(node.Props.get<string>("id"), node.Props.get<string>("icon"), node.Props.get<string>("name"));

  return guild;
}

export function guildChannels(guild_id: string): Channel[] {
  const url = `https://discord.com/api/v10/guilds/${guild_id}/channels`
  const response = http.fetch(url)
  const data = response.json<JSON.Raw>(); //console.log(data);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch messages. Received: ${response.status} ${response.statusText}`,
    );
  }
  return response.json<Channel[]>()
}

export function channels2Neo(guild_id: string): string {
  const response = guildChannels(guild_id);

  for (let i = 0; i < response.length; i++) {
    const id = response[i].id;
    const parent_id = response[i].parent_id === 'ul' ? '' : response[i].parent_id; //console.log(parent_id);
    const name = response[i].name; console.log(name);
    const topic = response[i].topic === 'ul' ? '' : response[i].topic; //console.log(topic);
    const guild_id = response[i].guild_id;

    addChannel(id, parent_id, name, topic, guild_id);
  }

  return 'OK'
}

export function addChannel(id: string, parent_id: string, name: string, topic: string, guild_id: string): Channel {
  const query = `
  MERGE (n:Channel {id: $id, parent_id: $parent_id, name: $name, topic: $topic, guild_id: $guild_id})
  MERGE (m:Guild {id: $guild_id})
  MERGE (n)-[:IN]->(m)`
  const vars = new neo4j.Variables();
  vars.set("id", id);
  vars.set("parent_id", parent_id);
  vars.set("name", name);
  vars.set("topic", topic);
  vars.set("guild_id", guild_id);
  neo4j.executeQuery('neo4j', query, vars);
  
  const channel = new Channel(id, parent_id, name, topic, guild_id);
  return channel;
}