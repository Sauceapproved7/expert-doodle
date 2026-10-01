export const WORLDS=[
{id:"reading",name:"Word Woods",icon:"Aa",description:"Sound out words, spot rhymes, and build reading power."},
{id:"math",name:"Number Nebula",icon:"123",description:"Count, add, subtract, and solve number missions."},
{id:"science",name:"Discovery Bay",icon:"LAB",description:"Explore animals, weather, plants, Earth, and space."},
{id:"logic",name:"Puzzle Peaks",icon:"?",description:"Find patterns, sequences, shapes, and clever solutions."}
];

const BANK={
reading:[
{difficulty:1,prompt:"Which word starts with the /b/ sound?",choices:["ball","cat","sun"],answer:"ball",hint:"Say each word slowly."},
{difficulty:1,prompt:"Which word rhymes with cat?",choices:["hat","cup","dog"],answer:"hat",hint:"Listen to the ending sound."},
{difficulty:2,prompt:"Choose the word that completes: The dog can ___.",choices:["run","blue","three"],answer:"run",hint:"Which choice is something a dog can do?"},
{difficulty:3,prompt:"Which sentence makes sense?",choices:["The bird can fly.","The shoe eats soup.","The moon barks."],answer:"The bird can fly.",hint:"Picture each sentence in your mind."}
],
math:[
{difficulty:1,prompt:"What is 3 + 2?",choices:["4","5","6"],answer:"5",hint:"Start at 3 and count two more."},
{difficulty:1,prompt:"Which number is bigger?",choices:["7","4"],answer:"7",hint:"Count up to each number."},
{difficulty:2,prompt:"You have 8 stars and give away 3. How many remain?",choices:["4","5","6"],answer:"5",hint:"Count backward three times from 8."},
{difficulty:3,prompt:"What makes 10?",choices:["6 + 4","3 + 4","2 + 5"],answer:"6 + 4",hint:"Add each pair."}
],
science:[
{difficulty:1,prompt:"What do plants need to grow?",choices:["water","toys","shoes"],answer:"water",hint:"Think about what you give a houseplant."},
{difficulty:1,prompt:"Which animal lives in water?",choices:["fish","cat","chicken"],answer:"fish",hint:"Which one swims all day?"},
{difficulty:2,prompt:"What usually happens after water freezes?",choices:["It becomes ice.","It becomes sand.","It disappears."],answer:"It becomes ice.",hint:"Think about an ice tray."},
{difficulty:3,prompt:"Earth moves around which star?",choices:["the Sun","the Moon","Mars"],answer:"the Sun",hint:"It lights our daytime sky."}
],
logic:[
{difficulty:1,prompt:"What comes next? circle, square, circle, square, ...",choices:["circle","triangle","star"],answer:"circle",hint:"The two shapes repeat."},
{difficulty:1,prompt:"Which one is different?",choices:["apple","banana","chair"],answer:"chair",hint:"Two choices are food."},
{difficulty:2,prompt:"What comes next? 2, 4, 6, ...",choices:["7","8","9"],answer:"8",hint:"The numbers jump by two."},
{difficulty:3,prompt:"If red is before blue, and blue is before green, which is first?",choices:["red","blue","green"],answer:"red",hint:"Follow the order from the beginning."}
]};

export function createPlayer({name="Explorer",age=6}={}){const safeAge=Math.max(5,Math.min(7,Number(age)||6));return{name:String(name).trim().slice(0,24)||"Explorer",age:safeAge,level:1,xp:0,streak:0,mastery:{reading:0,math:0,science:0,logic:0},badges:[],completed:0};}
export function gradeAnswer(player,{subject,correct}){if(!WORLDS.some(w=>w.id===subject))throw new TypeError("unknown subject");const next=structuredClone(player);if(correct){next.xp+=10;next.streak+=1;next.completed+=1;next.mastery[subject]=Math.min(10,next.mastery[subject]+1);if(next.streak===3&&!next.badges.includes("Hot Streak"))next.badges.push("Hot Streak");}else{next.streak=0;next.mastery[subject]=Math.max(0,next.mastery[subject]-1);}next.level=1+Math.floor(next.xp/50);return next;}
export function nextChallenge(player,subject,index=0){const list=BANK[subject];if(!list)throw new TypeError("unknown subject");const mastery=player.mastery?.[subject]??0;const target=mastery>=7?3:mastery>=3?2:1;const eligible=list.filter(q=>q.difficulty<=target);return{...eligible[Math.abs(index)%eligible.length],subject};}
export function summarizeProgress(player){return{name:player.name,age:player.age,level:player.level,totalXp:player.xp,completed:player.completed,streak:player.streak,mastery:{...player.mastery},badges:[...player.badges]};}
