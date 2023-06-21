var $ = Dom7;

var device = Framework7.getDevice();

var app = initializeApp(device);
initializeDOMEventHandlers();

var ncmb;
var loginPopup;

document.addEventListener("DOMContentLoaded", initializeApplication);

function initializeApp(device) {
  return new Framework7({
    name: "My App",
    theme: "auto",
    el: "#app",
    id: "io.framework7.myapp",
    routes: getRoutes(),
    input: getInputSettings(device),
    statusbar: getStatusbarSettings(),
    on: {
      init: function () {
        var f7 = this;
        if (f7.device.cordova) {
          cordovaApp.init(f7);
        }
      },
    },
  });
}

function getRoutes() {
  return [
    { path: "/", url: "./index.html" },
    { path: "/browse/", url: "./pages/browse.html" },
    { path: "/new_entry/", url: "./pages/entry.html" },
    { path: "(.*)", url: "./pages/404.html" },
  ];
}

function getInputSettings(device) {
  return {
    scrollIntoViewOnFocus: device.cordova && !device.electron,
    scrollIntoViewCentered: device.cordova && !device.electron,
  };
}

function getStatusbarSettings() {
  return {
    iosOverlaysWebView: true,
    androidOverlaysWebView: false,
  };
}

function initializeDOMEventHandlers() {
  $("#loginBtn").on("click", login);
  $("#addItem").on("click", addItem);
  $("#browseTab").on("click", function () {
    refreshBrowse(new Date($("#todaysDate").html()));
  });
  $("#reports").on("click", ".deleteItem", function (e) {
    deleteItem($(e.target).data("id"));
  });
}

async function initializeApplication(e) {
  const applicationKey = "";
  const clientKey = "";
  ncmb = new NCMB(applicationKey, clientKey);

  checkAuth();
  makeCategory();

  const day = dayjs().format("YYYY-MM-DD");
  $("#todaysDate").html(day);
}

//Redirect the user to the appropriate screen according to their login status
async function checkAuth() {
    const loggedIn = await loginCheck.bind(this)();
    if (loggedIn) {
        console.log("logged in")
    } else {
        //If the user is not logged in, open the login-signup popup
        console.log('not logged in')
        loginPopup = app.popup.create({
            el: "#loginScreen"
        });
        loginPopup.open();
    }
}

//Check the login status of the user
async function loginCheck() {
    const user = ncmb.User.getCurrentUser();
    if (!user) {
        // User is not logged in
        return false;
    }
    try {
        // Validate the session
        await ncmb.DataStore('Test').fetch();
        return true;
    } catch (e) {
        // If the session is invalid, an error will occur. In that case, delete the authentication data in localStorage.
        //localStorage.removeItem(NCMB / ${ ncmb.apiKey } / currentUser);
        ncmb.sessionToken = null;
        return false;
    }
}

//Perform authentication process
async function login() {
    const userName = document.querySelector('#username').value;
    const password = document.querySelector('#password').value;
    const displayName = document.querySelector('#displayName').value;
    //If these credentials have already been registered, the function will throw an error
    try {
        var user = new ncmb.User();
        user.set("userName", userName)
            .set("password", password)
            .set("displayName", displayName)
        await user.signUpByAccount();
    } catch (e) {
        console.log(e);
    }
    try {
        //Login process
        await ncmb.User.login(userName, password);
        //If the login is a success we close the popup
        loginPopup.close();
    } catch (e) {
        app.dialog.alert('Login failed. Please check your username and password.')
        return false;
    }
}

/*
    Categoty creation process
    Add the data from the Category class in NCMB to the <select> tag
*/
async function makeCategory() {
    const categories = await ncmb.DataStore('Category').fetchAll();
    const category = document.querySelector('#category');
    categories.forEach(c => {
        let option = document.createElement('option');
        option.setAttribute('value', c.get('name'));
        option.innerHTML = c.get('name');
        category.appendChild(option);
    });
}

//Process to add a daily report item
async function addItem() {
    const date = new Date(document.querySelector("#date").value);
    const user = ncmb.User.getCurrentUser();

    //Create a datastore class
    const Report = ncmb.DataStore('Report');
    // Create an instance
    const report = new Report();
    // Set each item in the daily report as part of the instance
    ['description', 'time', 'category'].forEach(s => {
        const selector = "#" + s
        report.set(s, document.querySelector(selector).value)
    });
    //Set the rest of the items
    report
        .set('date', date)
        .set('user', user);
    // ACL Create access rights
    const acl = new ncmb.Acl();
    acl
        .setUserReadAccess(user, true)     // the person in question can read
        .setUserWriteAccess(user, true)    // the person in question can write
        .setRoleReadAccess('admin', true); // users in the admin group can also read
    report.set('acl', acl)
    //Set and save ACL
    await report.save();
    //Screen redraw
    refresh.bind(this)(date);
}

//Process to refresh the screen
async function refresh(date) {
    console.log("refresh")
    //Retrieve data from daily reports
    const reports = await getItem(date);
    //Reflect the new data on the screen
    viewReport.bind(this)(reports);
}

async function refreshBrowse(date) {
    console.log("refresh browse")
    //Retrieve all the data from daily reports
    const reports = await getItem(date, true);
    //Reflect it on screen
    viewBrowseReport.bind(this)(reports);
}

/*
    Function to get daily report data from NCMB
    Arguments:
        date: Date to retrieve (date type)
        all: Wether all data is targeted or not. All the data is targeted only for the admin accounts
    Returned value:
        array of daily report data
*/
async function getItem(date, all = false) {
    const Report = ncmb.DataStore('Report');
    const query = Report
        .equalTo('date', date)
        .include('user');
    if (!all) {
        const user = ncmb.User.getCurrentUser();
        query.equalTo('user', {
            __type: 'Pointer', className: 'user', objectId: user.objectId
        });
    }
    return await query.fetchAll();
}

//Process to display daily report data
function viewReport(reports) {
    const html = [];
    reports.forEach(r => {
        //Make a list item for each report
        html.push(`
        <li>
            <block>
            <div class="item-content grid grid-cols-3 grid-gap">
                <div class="item-inner">
                    <div class="item-title">${r.get('time')} / ${r.get('category')}&nbsp;</div>
                    <div>&nbsp;${r.get('description')}</div>
                    <div class="item-after deleteItem">
                    <a><i class="icon material-icons if-md" data-id="${r.get('objectId')}">delete</i></a></div>
                </div>
            </div>
            </block>
        </li>
        `);
    });
    //Reflect it in the DOM
    document.querySelector('#reports').innerHTML = html.join('');
    //Add a deletion event to the trash icon for every listing
    document.querySelectorAll('.deleteItem').forEach(d => {
        // When the icon is clicked
        d.onclick = (e) => {
            console.log(e)
            //Obtain object id
            const objectId = e.target.dataset.id;
            //Data deletion
            deleteItem.bind(this)(objectId);
        }
    });
}

/*
    Process to display daily report data in the Browse screen
    Arguments:
        reports: Array type. Daily report data to be displayed
*/
function viewBrowseReport(reports) {
    const user = ncmb.User.getCurrentUser();
    const admin = user.get('admin');
    const html = [];
    reports.forEach(r => {
        //Retrieve username
        const name = `<div class="item-after">${r.get('user').displayName}</div>`;
        html.push(`
        <li>
            <block>
                <div class="item-content grid grid-cols-2 grid-gap">
                    <div class="item-inner>
                        <div class="item-title">${r.get('time')} / ${r.get('category')}&nbsp;</div>
                        <div class="item-title">&nbsp;${r.get('description')}</div>
                        ${admin ? name : ''}
                    </div>
                </div>
            </block>
        </li>
        `);
    });
    //Reflect it in the DOM
    document.querySelector('#admin-reports').innerHTML = html.join('');
}

/*
    Deletes a daily report item
    Arguments:
        objectId: String. Unique ID of the class.
*/
async function deleteItem(objectId) {
    //Greate a DataStore class
    const Report = ncmb.DataStore('Report');
    //Create an instance of the class
    const report = new Report();
    //Set the objectId and delete
    await report
        .set('objectId', objectId)
        .delete();
    //Get the date for screen refresh
    const date = new Date(document.querySelector("#date").value);
    //Refresh the screen
    refresh.bind(this)(date);
}


