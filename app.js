const express = require('express')
const path = require('path')
const cookieParser = require('cookie-parser')
const session = require('express-session')
const passport = require('passport')
const passportLocalMongoose = require('passport-local-mongoose')
const mongoose = require('mongoose')
const flash = require('connect-flash')
const chart = require('chart.js')

const app = express()

const server = require('http').createServer(app)

app.set('view engine', 'ejs')

app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())
app.use(express.static(path.join(__dirname, 'public')))
app.use(flash())

app.use(
  session({
    secret: 'Secret for password.',
    resave: false,
    saveUninitialized: false,
  })
)

app.use(passport.initialize())
app.use(passport.session())

mongoose.connect(`mongodb+srv://DPG:DPG@dpg.mexbs.mongodb.net/DPGDB`, {
  useNewUrlParser: true,
  useCreateIndex: true,
  useUnifiedTopology: true,
})

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  admin: { type: Boolean, default: false },
  zone: [],
  form: [],
})

const memberSchema = new mongoose.Schema({
  username: String,
  password: String,
  zone: String,
})

const formSchema = new mongoose.Schema({
  formname: String,
  fields: Number,
  totalfields: Number,
  data: mongoose.Schema.Types.Mixed,
  zone: { type: String, default: '' },
  response: [],
})

userSchema.plugin(passportLocalMongoose)

const User = new mongoose.model('User', userSchema)
const Member = new mongoose.model('Member', memberSchema)
const Form = new mongoose.model('Form', formSchema)

passport.use(User.createStrategy())

passport.serializeUser(User.serializeUser())
passport.deserializeUser(User.deserializeUser())

app.get('/error', (req, res) => {
  res.render(__dirname + '/views/error.ejs')
})

app.get('/', (req, res) => {
  res.redirect('/adminlogin')
})

app.get('/adminlogin', (req, res) => {
  res.render(__dirname + '/views/adminlogin.ejs')
})

app.get('/memberlogin', (req, res) => {
  res.render(__dirname + '/views/memberlogin.ejs')
})

app.get('/adminregister', (req, res) => {
  res.render(__dirname + '/views/adminregister.ejs')
})

app.post('/adminregister', (req, res) => {
  const user = new User({
    username: req.body.username,
    password: req.body.password,
  })

  User.register(
    { username: req.body.username },
    req.body.password,
    function (err, user) {
      if (err) {
        res.redirect('/error')
      } else {
        passport.authenticate('local')(req, res, function () {
          res.redirect('/adminlogin')
        })
      }
    }
  )
})

app.post('/adminlogin', (req, res) => {
  const user = new User({
    username: req.body.username,
    password: req.body.password,
  })

  req.login(user, function (err) {
    if (err) {
      res.redirect('/error')
    }
    passport.authenticate('local')(req, res, function () {
      res.redirect('/adminhome')
    })
  })
})

app.post('/memberlogin', (req, res) => {
  Member.find(
    {
      $and: [{ username: req.body.username }, { password: req.body.password }],
    },
    (err, result) => {
      if (err) {
        res.redirect('/error')
      } else {
        if (result[0] == undefined) {
          res.redirect('/error')
        } else {
          Form.find({ zone: result[0].zone }, (err, form) => {
            if (err) {
              res.redirect('/error')
            } else {
              res.render(__dirname + '/views/memberHome.ejs', {
                memberobj: result[0],
                f: form[0],
              })
            }
          })
        }
      }
    }
  )
})

app.post('/memberhome/submit', (req, res) => {
  const data = req.body

  Form.find({ zone: req.body.zone }, (err, findform) => {
    if (err) {
      res.redirect('/error')
    } else {
      if (findform) {
        findform[0].response.push(data)
        findform[0].save(function () {
          Member.find(
            {
              $and: [
                { username: req.body.username },
                { password: req.body.password },
              ],
            },
            (err, result) => {
              if (err) {
                res.redirect('/error')
              } else {
                Form.find({ zone: result[0].zone }, (err, form) => {
                  if (err) {
                    res.redirect('/error')
                  } else {
                    res.render(__dirname + '/views/memberHome.ejs', {
                      memberobj: result[0],
                      f: form[0],
                    })
                  }
                })
              }
            }
          )
        })
      }
    }
  })
})

app.get('/adminlogout', (req, res) => {
  req.logout()
  res.redirect('/adminlogin')
})

app.get('/memberlogout', (req, res) => {
  req.logout()
  res.redirect('/memberlogin')
})

app.get('/adminhome', (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.admin) {
      Form.find({}, (err, foundform) => {
        if (err) {
          res.redirect('/error')
        } else {
          if (foundform) {
            res.render(__dirname + '/views/adminDashboard.ejs', {
              forms: foundform,
            })
          }
        }
      })
    } else {
      res.redirect('/adminlogin')
    }
  } else {
    res.redirect('/adminlogin')
  }
})

app.get('/adminhome/createMember', (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.admin) {
      Member.find({}, (err, mem) => {
        res.render(__dirname + '/views/createMember.ejs', { memberobj: mem })
      })
    } else {
      res.redirect('/adminlogin')
    }
  } else {
    res.redirect('/adminlogin')
  }
})

app.get('/adminhome/createMember/addMember', (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.admin) {
      res.render(__dirname + '/views/addMember.ejs')
    } else {
      res.redirect('/adminlogin')
    }
  } else {
    res.redirect('/adminlogin')
  }
})

app.post('/adminhome/createMember/addMember', (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.admin) {
      const member = new Member({
        username: req.body.username,
        password: req.body.password,
        zone: req.body.zone,
      })
      User.findById(req.user.id, (err, foundUser) => {
        if (err) {
          res.redirect('/adminlogin')
        } else {
          if (foundUser) {
            foundUser.zone.push(req.body.zone)
            foundUser.save(function () {
              member.save(function () {
                res.redirect('/adminhome/createMember')
              })
            })
          }
        }
      })
    } else {
      res.redirect('/adminlogin')
    }
  } else {
    res.redirect('/adminlogin')
  }
})

app.get('/adminhome/createForm/addForm', (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.admin) {
      res.render(__dirname + '/views/addForm.ejs', { number: 0 })
    } else {
      res.redirect('/adminlogin')
    }
  } else {
    res.redirect('/adminlogin')
  }
})

app.post('/adminhome/createForm/addForm', (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.admin) {
      const obj = req.body
      const formname = req.body.formname
      const fields = req.body.fields
      const totalfields = req.body.totalfields
      delete obj.fields
      delete obj.formname
      delete obj.element
      delete obj.totalfields
      const form = new Form({
        formname: formname,
        fields: fields,
        totalfields: totalfields,
        data: obj,
      })
      form.save(function (err, form) {
        User.findById(req.user.id, (err, foundUser) => {
          if (err) {
            res.redirect('/adminlogin')
          } else {
            if (foundUser) {
              res.render(__dirname + '/views/addZone.ejs', {
                formId: form._id,
                data: foundUser,
              })
            }
          }
        })
      })
    } else {
      res.redirect('/adminlogin')
    }
  } else {
    res.redirect('/adminlogin')
  }
})

app.post('/adminhome/createForm/addForm/addZone', (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.admin) {
      Form.findById(req.body.Id, (err, formfound) => {
        formfound.zone = req.body.zone
        formfound.save(function () {
          User.findById(req.user.id, (err, foundUser) => {
            foundUser.form.push(req.body.zone)
            foundUser.save(function () {
              res.redirect('/adminhome')
            })
          })
        })
      })
    }
  } else {
    res.redirect('/adminlogin')
  }
})

app.get('/adminhome/deleteform', (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.admin) {
      const zone = req.query.zone
      const formname = req.query.name
      Form.find(
        {
          $and: [{ zone: zone }, { formname: formname }],
        },
        (err, result) => {
          if (err) {
            res.redirect('/error')
          } else {
            Form.findByIdAndRemove(result[0]._id, (err) => {
              if (err) {
                res.redirect('/adminhome')
              } else {
                User.findById(req.user._id, (err, foundUser) => {
                  var index = foundUser.form.indexOf(zone)
                  if (index !== -1) {
                    foundUser.form.splice(index, 1)
                  }
                  foundUser.save(function () {
                    res.redirect('/adminhome')
                  })
                })
              }
            })
          }
        }
      )
    } else {
      res.redirect('/adminlogin')
    }
  } else {
    res.redirect('/adminlogin')
  }
})

app.get('/adminhome/updateform', (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.admin) {
      const zone = req.query.zone
      const formname = req.query.name
      Form.find(
        {
          $and: [{ zone: zone }, { formname: formname }],
        },
        (err, result) => {
          if (err) {
            res.redirect('/error')
          } else {
            res.render(__dirname + '/views/updateForm.ejs', {
              object: result[0],
            })
          }
        }
      )
    } else {
      res.redirect('/adminlogin')
    }
  } else {
    res.redirect('/adminlogin')
  }
})

app.post('/adminhome/updateform', (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.admin) {
      const obj = req.body
      Form.find({ zone: req.body.zone }, (err, result) => {
        if (err) {
          res.redirect('/error')
        } else {
          const formname = req.body.formname
          const fields = req.body.fields
          const totalfields = req.body.totalfields
          const zone = req.body.zone
          delete obj.fields
          delete obj.formname
          delete obj.element
          delete obj.totalfields
          delete obj.zone

          result[0].formname = formname
          result[0].fields = fields
          result[0].totalfields = totalfields
          result[0].data = obj

          result[0].save(function (err, form) {
            if (err) {
              res.redirect('/adminlogin')
            } else {
              res.redirect('/adminhome')
            }
          })
        }
      })
    } else {
      res.redirect('/adminlogin')
    }
  } else {
    res.redirect('/adminlogin')
  }
})

app.get('/adminhome/responses', (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.admin) {
      const zone = req.query.zone
      const formname = req.query.name
      Form.find(
        {
          $and: [{ zone: zone }, { formname: formname }],
        },
        (err, result) => {
          if (err) {
            res.redirect('/error')
          } else {
            res.render(__dirname + '/views/responses.ejs', {
              object: result[0],
            })
          }
        }
      )
    } else {
      res.redirect('/adminlogin')
    }
  } else {
    res.redirect('/adminlogin')
  }
})

let port = null

if (port == null || port == '') {
  port = 3000
}

server.listen(port, () => {
  console.log('Website is running')
})
