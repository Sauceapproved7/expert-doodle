import test from "node:test";
import assert from "node:assert/strict";
import {createPlayer, gradeAnswer, nextChallenge, summarizeProgress, WORLDS} from "../learning-adventure/engine.mjs";

test("starts a six-year-old at level one with a safe local profile",()=>{const p=createPlayer({name:"Explorer",age:6});assert.equal(p.level,1);assert.equal(p.xp,0);assert.deepEqual(p.mastery,{reading:0,math:0,science:0,logic:0});assert.equal(p.age,6);});

test("correct answers award XP and increase subject mastery",()=>{const p=createPlayer({name:"Explorer",age:6});const n=gradeAnswer(p,{subject:"math",correct:true});assert.equal(n.xp,10);assert.equal(n.mastery.math,1);assert.equal(n.streak,1);});

test("wrong answers never remove XP and reduce difficulty pressure",()=>{const p={...createPlayer({name:"Explorer",age:6}),xp:20,mastery:{reading:0,math:3,science:0,logic:0},streak:2};const n=gradeAnswer(p,{subject:"math",correct:false});assert.equal(n.xp,20);assert.equal(n.mastery.math,2);assert.equal(n.streak,0);});

test("adaptive challenge stays age appropriate and advances after mastery",()=>{const p={...createPlayer({name:"Explorer",age:6}),mastery:{reading:5,math:5,science:0,logic:0}};const c=nextChallenge(p,"math",0);assert.equal(c.subject,"math");assert.ok(c.difficulty>=1&&c.difficulty<=3);assert.ok(c.prompt.length>0);assert.ok(c.choices.length>=2);});

test("progress summary exposes learning data without child contact data",()=>{const p=createPlayer({name:"Explorer",age:6});const s=summarizeProgress(p);assert.equal(s.totalXp,0);assert.equal(s.age,6);assert.equal("email" in s,false);assert.equal("location" in s,false);});

test("ships four core adventure worlds",()=>{assert.deepEqual(WORLDS.map(w=>w.id),["reading","math","science","logic"]);});
