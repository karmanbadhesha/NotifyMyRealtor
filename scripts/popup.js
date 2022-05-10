// check onload to see if user is already logged in
window.onload = function () {
  chrome.storage.local.get(["email", "token", "userId"], function (result) {
    if (result && result.token && result.email) {
      console.log("result: ", result);
      setLoggedInState({
        email: result.email,
        token: result.token,
        userId: result.userId,
      });
    } else {
      setLoggedOutState();
    }
  });
};

let authorize_button = document.getElementById("authorize_button");
authorize_button.addEventListener("click", async function () {
  authorizeActionClicked();
});

let signout_button = document.getElementById("signout_button");
signout_button.addEventListener("click", async function () {
  signoutActionClicked();
});

let add_realtor_button = document.getElementById("add_realtor");
add_realtor_button.addEventListener("click", async function () {
  setIdVisible("new_realtor_form");
});

let new_realtor_form = document.getElementById("new_realtor_form");
new_realtor_form.addEventListener("submit", (e) => {
  const data = Object.fromEntries(new FormData(e.target).entries());
  addNewRealtor(data);
  console.log(data);
  setIdInvisible("new_realtor_form");
  // e.preventDefault();
});

async function getCurrentTab() {
  let queryOptions = { active: true, currentWindow: true };
  let [tab] = await chrome.tabs.query(queryOptions);
  return tab;
}

async function addNewRealtor(data) {
  let { new_realtor_name, new_realtor_email } = data;
  const does_realtor_exist = await checkExistingRealtor(new_realtor_email);
  console.log("does_realtor_exist", does_realtor_exist);
  if (does_realtor_exist) {
    // find and replace existing reator
    chrome.storage.local.get(["realtors"], function (result) {
      if (result && result.realtors) {
        let realtors = result.realtors;
        const index = realtors.findIndex((r) => r.email === new_realtor_email);
        if (index) {
          realtors[index] = {
            name: new_realtor_name,
            email: new_realtor_email,
          };
        }
        chrome.storage.local.set({ realtors: realtors });
        console.log("replaced realtor");
      }
    });
  } else {
    // if this email doesn't exist
    chrome.storage.local.get(["realtors"], function (result) {
      if (result && result.realtors) {
        // if there are other realtors
        let realtors = result.realtors;
        realtors.push({ name: new_realtor_name, email: new_realtor_email });
        chrome.storage.local.set({ realtors: realtors });
        console.log("added new realtor");
      } else {
        // if no realtor exists
        let realtors = [];
        realtors.push({ name: new_realtor_name, email: new_realtor_email });
        chrome.storage.local.set({ realtors: realtors });
      }
    });
  }
  fetchRealtors();
}

function fetchRealtors() {
  return new Promise(function (resolve, reject) {
    chrome.storage.local.get(["realtors"], function (result) {
      if (result && result.realtors) {
        console.log(result.realtors);
        generateRealtorTable(result.realtors);
        createRealtorListeners(result.realtors);
        resolve(result.realtors);
      }
      resolve([]);
    });
  });
}

function deleteRealtorByIndex(index) {
  return new Promise(function (resolve, reject) {
    chrome.storage.local.get(["realtors"], function (result) {
      if (result && result.realtors) {
        result.realtors.splice(index, 1);
        chrome.storage.local.set({ realtors: result.realtors });
        resolve(result.realtors);
      }
      resolve([]);
    });
  });
}

function emailRealtorByIndex(index) {
  return new Promise(async function (resolve, reject) {
    const tab = await getCurrentTab();

    chrome.storage.local.get(["userId", "token"], function (result) {
      if (result) {
        console.log("emailRealtorByIndex: ", result);
        const userId = result.userId;
        const token = result.token;

        console.log("TOKEN: ", token);
        post({
          url: `https://gmail.googleapis.com/gmail/v1/users/${userId}/messages/send`,
          callback: (result) => {
            console.log("EMAIL RESULT: ", result);
          },
          token: token,
          data: {
            raw: "",
          },
        });
      }
      resolve([]);
    });

    //   chrome.storage.local.get(["realtors"], function (result) {
    //     if (result && result.realtors) {
    //       result.realtors.splice(index, 1);
    //       chrome.storage.local.set({ realtors: result.realtors });
    //       resolve(result.realtors);
    //     }
    //     resolve([]);
    //   });
  });
}

async function checkExistingRealtor(email) {
  console.log("checkExistingRealtor: EMAIL: ", email);
  return new Promise(function (resolve, reject) {
    chrome.storage.local.get(["realtors"], function (result) {
      if (result && result.realtors) {
        let found_email = result.realtors.filter((r) => r.email === email)[0];
        console.log("found_email: ", found_email);
        if (found_email && found_email.email === email) {
          resolve(true);
        }
      }
      resolve(false);
    });
  });
}

function createRealtorListeners(realtors) {
  let buttonTypes = ["delete", "email"];
  for (var i = 0; i < realtors.length; i++) {
    for (var j = 0; j < buttonTypes.length; j++) {
      let realtor_button = document.getElementById(
        `${i}_email_${buttonTypes[j]}`
      );
      realtor_button.addEventListener("click", (e) => {
        console.log("E: ", e);
        let type = e.target.id.split("_")[2];
        let index = e.target.id.split("_")[0];
        console.log("TYPE: ", type);
        console.log("index: ", index);

        switch (type) {
          case "delete": {
            deleteRealtorByIndex(index);
          }
          case "email": {
            emailRealtorByIndex(index);
          }
        }
      });
    }
  }
}

// Create an HTML table using the JSON data.
function generateRealtorTable(data) {
  console.log("generateRealtorTable: ", data);

  var headers = ["Name", "Email", "Action"];

  var table = document.createElement("TABLE"); //makes a table element for the page

  for (var i = 0; i < data.length; i++) {
    var row = table.insertRow(i);
    row.insertCell(0).innerHTML = data[i].name;
    row.insertCell(1).innerHTML = data[i].email;
    row.insertCell(
      2
    ).innerHTML = `<button id="${i}_email_delete"}>Delete</button><button id="${i}_email_email"}>Email</button>`;
  }

  var header = table.createTHead();
  var headerRow = header.insertRow(0);
  for (var i = 0; i < headers.length; i++) {
    headerRow.insertCell(i).innerHTML = headers[i];
  }

  // Finally, add the dynamic table to a container.
  var divContainer = document.getElementById("realtor_table");
  divContainer.innerHTML = "";
  divContainer.appendChild(table);
}

function setLoggedInState(options) {
  console.log("options: ", options);
  chrome.storage.local.set({
    token: options.token,
    email: options.email,
    userId: options.userId,
  });
  setIdInvisible("authorize_button");
  setIdVisible("signout_button");
  setIdVisible("logged_in");
  setEmailText(options.email);
  fetchRealtors();
}

function setLoggedOutState() {
  chrome.storage.local.set({ token: null, email: null, userId: null });
  setIdInvisible("signout_button");
  setIdInvisible("logged_in");
  setIdVisible("authorize_button");
  setEmailText("");
}

function setIdInvisible(id) {
  document.getElementById(id).style.display = "none";
}

function setIdVisible(id) {
  document.getElementById(id).style.display = "block";
}

function setEmailText(text) {
  console.log("set email text: ", text);
  document.getElementById("current_email").innerHTML = text;
}

// listen to token changing to update current_email accordingly
chrome.storage.onChanged.addListener(function (changes, namespace) {
  for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
    console.log(
      `Storage key "${key}" in namespace "${namespace}" changed.`,
      `Old value was "${oldValue}", new value is "${newValue}".`
    );
    if (key === "realtors") {
      generateRealtorTable(newValue);
    }
    // if (key === "token") {
    //   if (newValue === null) {
    //     setEmailText("");
    //   }
    // }
    // if (key === "email") {
    //   if (newValue !== null) {
    //     setEmailText(newValue);
    //   }
    // }
  }
});

/**
 * User clicked on authorize button. Check if user is authenticated.
 *
 */
function authorizeActionClicked() {
  console.log("authorizeActionClicked");
  getAuthToken({
    interactive: true,
    callback: getBrowserActionAuthTokenCallback,
  });
}

/**
 * User clicked on sign out button. Remove all access tokens from Identity API's token cache.
 *
 * @param {object} tab - Chrome tab resource.
 */
function signoutActionClicked() {
  chrome.identity.clearAllCachedAuthTokens((callback) => {
    console.log("successfully logged out: ", callback);
    setLoggedOutState();
  });
}

/**
 * Get users access_token.
 *
 * @param {object} options
 *   @value {boolean} interactive - If user is not authorized ext, should auth UI be displayed.
 *   @value {function} callback - Async function to receive getAuthToken result.
 */
function getAuthToken(options) {
  console.log("getAuthToken");
  chrome.identity.getAuthToken(
    { interactive: options.interactive },
    options.callback
  );
}

/**
 * If user is authenticated open Gmail in new tab or start auth flow.
 *
 * @param {string} token - Current users access_token.
 */
async function getBrowserActionAuthTokenCallback(token) {
  console.log("getBrowserActionAuthTokenCallback");
  if (chrome.runtime.lastError) {
    console.log("chrome.runtime.lastError", chrome.runtime.lastError);
    getAuthToken({
      interactive: true,
      callback: getBrowserActionAuthTokenCallback,
    });
  } else {
    try {
      // successful auth
      console.log("getBrowserActionAuthTokenCallback ELSE");
      const { email, id } = await getProfile();

      setLoggedInState({ email: email, token: token, userId: id });
    } catch (error) {
      alert(error);
      setLoggedOutState();
    }
  }
}

/**
 * Get the current users Google+ profile to welcome them.
 *
 * https://developers.google.com/+/api/latest/people/get
 *
 * @param {string} token - Current users access_token.
 */
function getProfile() {
  return new Promise(function (resolve, reject) {
    chrome.identity.getProfileUserInfo(function (user_info) {
      if (user_info && user_info.email) {
        console.log("USER_INFO: ", user_info);
        resolve(user_info);
      } else {
        reject("Error fetching email");
      }
    });

    // chrome.storage.local.get(["token"], function (result) {
    //   if (result) {
    //     const token = result.token;
    //     get({
    //       url: "https://www.googleapis.com/plus/v1/people/me",
    //       callback: (person) => {
    //         console.log("PERSON :", person);
    //       },
    //       token: token,
    //     });
    //   }
    //   resolve([]);
    // });
  });
}

/**
 * Make an authenticated HTTP GET request.
 *
 * @param {object} options
 *   @value {string} url - URL to make the request to. Must be whitelisted in manifest.json
 *   @value {string} token - Google access_token to authenticate request with.
 *   @value {function} callback - Function to receive response.
 */
function get(options) {
  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4 && xhr.status === 200) {
      // JSON response assumed. Other APIs may have different responses.
      options.callback(JSON.parse(xhr.responseText));
    } else {
      console.log("get", xhr.readyState, xhr.status, xhr.responseText);
    }
  };
  xhr.open("GET", options.url, true);
  // Set standard Google APIs authentication header.
  xhr.setRequestHeader("Authorization", "Bearer " + options.token);
  xhr.send();
}

/**
 * Make an authenticated HTTP POST request.
 *
 * @param {object} options
 *   @value {string} url - URL to make the request to. Must be whitelisted in manifest.json
 *   @value {string} token - Google access_token to authenticate request with.
 *   @value {function} callback - Function to receive response.
 */
function post(options) {
  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4 && xhr.status === 200) {
      // JSON response assumed. Other APIs may have different responses.
      options.callback(JSON.parse(xhr.responseText));
    } else {
      console.log("get", xhr.readyState, xhr.status, xhr.responseText);
    }
  };
  xhr.open("POST", options.url, true);
  // Set standard Google APIs authentication header.
  xhr.setRequestHeader("Accept", "application/json");
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.setRequestHeader("Authorization", "Bearer " + options.token);
  xhr.send(options.data);
}
