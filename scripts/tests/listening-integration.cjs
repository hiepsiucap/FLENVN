/* Run against a disposable PostgreSQL database only. AI and AWS are mocked. */
require('reflect-metadata');
const assert=require('node:assert/strict');
const {DataSource}=require('typeorm');
const {Test}=require('@nestjs/testing');
const {ValidationPipe}=require('@nestjs/common');
const {getRepositoryToken}=require('@nestjs/typeorm');
const request=require('supertest');
const {ListeningSet}=require('../../dist/listening/listening-set.entity');
const {FlashCard}=require('../../dist/flashcards/flashcard.entity');
const {ListeningController}=require('../../dist/listening/listening.controller');
const {ListeningService}=require('../../dist/listening/listening.service');
const {ListeningModelService}=require('../../dist/listening/listening-model.service');
const {FlashcardAudioService}=require('../../dist/flashcards/flashcard-audio.service');
const {JwtAuthGuard}=require('../../dist/auth/guards/jwt-auth.guard');
const {ResponseInterceptor}=require('../../dist/common/interceptors/response.interceptor');
const {CreateListeningSets1723280000000}=require('../../dist/database/migrations/1723280000000-CreateListeningSets');
const {validateListeningContent}=require('../../dist/listening/listening-content');
const user='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',card='33333333-3333-4333-8333-333333333333';
(async()=>{
 if(process.env.LISTENING_TEST_DATABASE!=='disposable')throw new Error('Set LISTENING_TEST_DATABASE=disposable for an isolated database');
 const db=new DataSource({type:'postgres',host:'127.0.0.1',port:Number(process.env.LISTENING_TEST_PG_PORT),username:'postgres',password:'listening-local-test',database:'listening_validation',entities:[ListeningSet],synchronize:false});
 await db.initialize();let app;const runner=db.createQueryRunner();const migration=new CreateListeningSets1723280000000();
 try{
  await runner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await runner.query('CREATE TABLE users (id uuid PRIMARY KEY)');await runner.query('INSERT INTO users VALUES ($1),($2)',[user,other]);
  await migration.up(runner);console.log('PASS migration up on PostgreSQL');
  let models=0,audios=0;
  const cards={find:async({where})=>where.userId===user?[{id:card,word:'apple'}]:[],findOne:async({where})=>where.userId===user?{id:card,userId:user,example:'I eat an apple.'}:null,update:async()=>({affected:1})};
  const model={generate:async()=>{models++;return validateListeningContent(Array.from({length:5},(_,i)=>({prompt:`Which day is delivery ${i+1}?`,script:[{speaker:'A',text:'Your apple delivery is on Friday.'}],acceptedAnswers:['Friday'],evidence:'Friday',explanation:'Giao hàng vào thứ Sáu.'})),'catch-details',['apple']);}};
  const audio={createAudioUrl:async()=>{audios++;return'https://audio.example/test.mp3';}};
  const module=await Test.createTestingModule({controllers:[ListeningController],providers:[ListeningService,{provide:getRepositoryToken(FlashCard),useValue:cards},{provide:getRepositoryToken(ListeningSet),useValue:db.getRepository(ListeningSet)},{provide:ListeningModelService,useValue:model},{provide:FlashcardAudioService,useValue:audio}]}).overrideGuard(JwtAuthGuard).useValue({canActivate(context){const req=context.switchToHttp().getRequest();const id=req.headers['x-test-user'];if(!id)return false;req.user={id};return true;}}).compile();
  app=module.createNestApplication();app.setGlobalPrefix('api/v1');app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));app.useGlobalInterceptors(new ResponseInterceptor());await app.init();
  const server=app.getHttpServer(),path='/api/v1/listening/sets';const dto={flashcardIds:[card],game:'catch-details',difficulty:'easy'};
  await request(server).post(path).send(dto).expect(403);
  await request(server).post(path).set('x-test-user',user).send({...dto,flashcardIds:['invalid']}).expect(400);
  await request(server).post(path).set('x-test-user',user).send({...dto,flashcardIds:Array(21).fill(card)}).expect(400);
  await request(server).post(path).set('x-test-user',user).send({...dto,game:'not-a-game'}).expect(400);
  await request(server).post(path).set('x-test-user',user).send({...dto,correct:true}).expect(400);
  await request(server).post(path).set('x-test-user',other).send(dto).expect(404);
  assert.equal(models,0);assert.equal(audios,0);console.log('PASS HTTP authentication boundary, DTO limits, unknown fields, and card ownership before cost');
  const started=await request(server).post(path).set('x-test-user',user).send(dto).expect(201);const id=started.body.data.id;
  let ready;for(let i=0;i<20;i++){ready=await request(server).get(`${path}/${id}`).set('x-test-user',user).expect(200);if(ready.body.data.status==='ready')break;}
  assert.equal(ready.body.data.status,'ready');assert.equal(ready.body.data.questions.length,5);assert(!JSON.stringify(ready.body).includes('Friday'));
  const cached=await request(server).post(path).set('x-test-user',user).send(dto).expect(201);assert.equal(cached.body.data.id,id);assert.equal(models,1);assert.equal(audios,5);console.log('PASS persisted background generation, hidden answer keys, and cached audio reuse');
  await request(server).get(`${path}/${id}`).set('x-test-user',other).expect(404);
  await request(server).post(`${path}/${id}/answers`).set('x-test-user',other).send({questionId:'q1',answer:'Friday'}).expect(404);
  const grade=await request(server).post(`${path}/${id}/answers`).set('x-test-user',user).send({questionId:'q1',answer:'friday.'}).expect(201);assert.equal(grade.body.data.score,100);assert.equal(grade.body.data.correctAnswer,'Friday');assert(!('questions'in grade.body.data));console.log('PASS owner-only grading and answer-specific transcript reveal');
  await request(server).post(`${path}/sentence-audio`).set('x-test-user',user).send({flashcardId:card}).expect(201);
  assert.equal((await db.getRepository(ListeningSet).find()).length,1);
  await runner.query('DELETE FROM users WHERE id=$1',[user]);assert.equal((await db.getRepository(ListeningSet).find()).length,0);console.log('PASS user deletion cascades saved rounds');
  await migration.down(runner);const exists=await runner.query("SELECT to_regclass('public.listening_sets') AS name");assert.equal(exists[0].name,null);console.log('PASS migration rollback');
 }finally{if(app)await app.close();await runner.release();await db.destroy();}
})().catch(error=>{console.error(error);process.exit(1)});
