const express = require('express');
const app = express();
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.use('/public', express.static('public'));
const methodOverride = require('method-override');
app.use(methodOverride('_method'));

// session auth setting
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
app.use(session({ secret: '비밀코드', resave: true, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

var db;
const MongoClient = require('mongodb').MongoClient;
MongoClient.connect(
  'mongodb+srv://admin:qwer1234@cluster0.5lk2o3z.mongodb.net/?retryWrites=true&w=majority',
  { useUnifiedTopology: true },
  function (에러, client) {
    if (에러) return console.log(에러);

    db = client.db('todoapp');

    // test code:
    // db.collection('post').insertOne({ _id: 100, name: 'kim', age: 20 }, function (에러, 결과) {
    //   console.log("저장완료");
    // });


    //서버띄우는 코드
    app.listen(8080, function () {
      console.log('서버 is Ready to Fire http://localhost:8080');
    });
  })



// get 요청
app.get('/', function (요청, 응답) {
  응답.render('index.ejs');
  // 응답.sendFile(__dirname, '/index.ejs'); 처음 개발할때 코드인데 ejs로 변경하느라 코드 변경됨
});
app.get('/write', function (request, response) {
  response.render('write.ejs');
});
app.get("/list", function (요청, 응답) {
  db.collection('post').find().toArray(function (에러, 결과) {
    응답.render('list.ejs', { posts: 결과 }); // list.ejs 로 { posts: 결과 } 전달(데이터바인딩해주기위해서 작성함)
  });
});

// list.ejs에서 수정하기 눌리면 실행됨
app.get('/edit/:id', function (요청, 응답) {
  db.collection('post').findOne({ _id: parseInt(요청.params.id) }, function (에러, 결과) {
    응답.render('edit.ejs', { post: 결과 })
  })
});

// edit.ejs에서 수정하기 누르면 실행됨
app.put('/edit', function (요청, 응답) {
  db.collection('post').updateOne({ _id: parseInt(요청.body.id) }, { $set: { title: 요청.body.title, date: 요청.body.date } },
    function (에러, 결과) {
      console.log('수정완료')
      응답.redirect('/list')
    });
});


// 글쓰기 post 요청
app.post('/add', function (요청, 응답) {
  // 현재까지 이 코드의 문제점이 이부분인데 DB에 저장된 데이터가 post컬렉션에 저장되어있는 갯수와
  // counter에 저장되어있는 totalPost의 숫자가 안맞음
  // 그 이유는 id를 유니크하게 만드는 로직이 잘못됨
  // 차라리 자동생성되는 몽고디비 아이디를 사용하게는게 맞음.
  // 아니면 몽고디비에서 데이터 다 지우고 totalPost : 0 으로 직접 수정해도 됨.
  db.collection('counter').findOne({ name: '게시물 총갯수' }, function (에러, 결과) {
    // console.log(결과);
    let uniqueID = 결과.totalPost;

    db.collection('post').insertOne({ _id: uniqueID + 1, title: 요청.body.title, date: 요청.body.date }, function (에러, 결과) {
      db.collection('counter').updateOne({ name: '게시물 총갯수' }, {
        $inc: { totalPost: 1 }, function(에러, 결과) {
          if (에러) { return console.log(에러) }
        }
      })
    });
  });
  응답.redirect('/write');
});

// delete요청
app.delete('/delete', function (요청, 응답) {
  // console.log(요청.body);
  //{ _id: '2' }
  요청.body._id = parseInt(요청.body._id);
  // console.log(요청.body);
  // { _id: 2 }
  db.collection('post').deleteOne(요청.body, function (에러, 결과) {
    console.log("삭제완료");
    응답.status(200).send({ message: '삭제 성공' });
    if (에러) {
      응답.status(400).send({ message: '삭제 실패' });
    }
  })
})

// 상세페이지 get 요청
app.get('/detail/:id', function (request, response) {
  db.collection('post').findOne({ _id: parseInt(request.params.id) }, function (error, result) {
    // console.log(result);
    // db에서 {_id: request.params.id}인 게시물을 findOne(찾음)
    response.render('detail.ejs', { data: result });
  })
})

// sesson-based login request & Authenticate
app.get('/login', function (request, response) {
  response.render('login.ejs');
})
app.post('/login', passport.authenticate('local', { failureRedirect: '/fail' }), function (요청, 응답) {
  응답.redirect('/')
});
passport.use(new LocalStrategy({
  usernameField: 'id',
  passwordField: 'pw',
  session: true,
  passReqToCallback: false,
}, function (입력한아이디, 입력한비번, done) {
  //console.log(입력한아이디, 입력한비번);
  db.collection('login').findOne({ id: 입력한아이디 }, function (에러, 결과) {
    if (에러) return done(에러)

    if (!결과) return done(null, false, { message: '존재하지않는 아이디요' })
    if (입력한비번 == 결과.pw) {
      return done(null, 결과)
    } else {
      return done(null, false, { message: '비번틀렸어요' })
    }
  })
}));

passport.serializeUser(function (user, done) {
  done(null, user.id)
});

passport.deserializeUser(function (아이디, done) {
  done(null, {})
}); 


// 내가 만들어보는 회원가입
app.get('/authenticate', function (request, response) {
  response.render('authenticate.ejs');
})

app.post('/authentication', function (request, response) {
  db.collection('login').insertOne({
    userID: request.body.id,
    password: request.body.pw,
    userEmail: request.body.email
  }, function (에러, 결과) {
    if (에러) {
      console.log(에러);
      response.redirect('/');
      return;
    }

    console.log("새로운 사용자 등록 완료");
    response.render('mypage.ejs');
  })
});
