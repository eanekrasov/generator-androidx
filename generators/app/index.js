"use strict";
const Generator = require("yeoman-generator");
const chalk = require("chalk");
const yosay = require("yosay");
const through2 = require("through2");
const https = require("https");
const {JSDOM} = require("jsdom");

module.exports = class extends Generator {
  async prompting() {
    // Have Yeoman greet the user.
    this.log(yosay(`Welcome to the ${chalk.red("generator-androidx")} generator!`));
    this.params = {channel: "any"};

    let versionsResp = await this._httpsGet("https://developer.android.com/jetpack/androidx/versions");
    let libs = [];
    if (versionsResp.statusCode === 200) {
      const dom = new JSDOM(versionsResp.body);
      //let table = dom.window.document.querySelector("#version-table").nextElementSibling;
      let table = dom.window.document.querySelector("table");
      if (table != null) {
        libs = Array.from(table.querySelectorAll('tr'))
          .filter(row => row.id.length > 0)
          .map(row => this._rowToObj(row))
          .filter(row => !!row);
      } else {
        console.log("table not found");
      }
    }
    console.log(`${libs.length} libs found`);
    this.libs = await Promise.all(libs.map(async lib => {
      await this._processLib(lib);
      return lib;
    }));
    // for (const lib of libs) {
    //   await this._processLib(lib);
    // }
    // this.libs = libs;
  }

  writing() {
    this.registerTransformStream(through2.obj((chunk, enc, callback) => {
      callback(null, chunk);
    }));
    this.fs.copyTpl(this.templatePath("AndroidX.kt"), this.destinationPath("AndroidX.kt"), {libs: this.libs});
  }

  async _processLib(lib) {
    try {
      let libResp = await this._httpsGet(lib.url)
      if (libResp.statusCode === 200) {
        const dom = new JSDOM(libResp.body);
        let pre = dom.window.document.querySelector('pre.prettyprint');
        if (pre && pre.textContent.includes("dependencies {")) {
          console.log(lib.name);
          let preText = pre.textContent;
          preText = preText.substr(0, preText.indexOf('}\n') + 2)
          let obj = {
            "'": '"',
            'dependencies {\n': 'fun DependencyHandlerScope.androidx' + lib.nameCap + '(ver: String = "' + lib.version + '") {\n',
            'def [^\n]+': '',
            '"\n': '")\n',
            '" //': '") //',
            'implementation': 'add("implementation",',
            'testImplementation': 'add("testImplementation",',
            'debugImplementation': 'add("debugImplementation",',
            'androidTestImplementation': 'add("androidTestImplementation",',
            'kapt': 'add("kapt",',
            'annotationProcessor': 'add("annotationProcessor",',
            "\\${?\\w+}?":'\${ver}'
          };
          lib.text = this._replaceAll(preText, obj);
        }
      }
    } catch (e) {
      console.log(e);
    }
  }

  _rowToObj(row) {
    if (row.id.length > 0) {
      let tds = Array.from(row.querySelectorAll("td")).map(td => {
        if (td.textContent.includes("<")) {
          return td.textContent.substr(0, td.textContent.indexOf('<'))
        } else {
          return td.textContent
        }
      });
      try {
        let versions = {
          stable: tds[2],
          candidate: tds[3],
          beta: tds[4],
          alpha: tds[5],
        };
        return {
          url: "https://developer.android.com/jetpack/androidx/releases/" + tds[0],
          name: tds[0],
          nameCap: this._capitalize(tds[0]),
          versions: versions,
          version: this._version(versions),
          text: `// TODO ${tds[0]}`
        };
      } catch (e) {
        console.log(e);
        console.log(tds);
      }
    }
  }

  _version(lib) {
    if (lib.alpha !== '-') {
      return lib.alpha;
    } else if (lib.beta !== '-') {
      return lib.beta;
    } else if (lib.candidate !== '-') {
      return lib.candidate;
    } else {
      return lib.stable;
    }
  }

  _httpsGet(url) {
    return new Promise((resolve, reject) => https
      .get(url, resp => {
        let response = {
          statusCode: resp.statusCode,
          headers: resp.headers,
          body: []
        };
        resp.on('data', chunk => {
          response.body.push(chunk);
        });
        resp.on('end', () => {
          response.body = response.body.join("");
          resolve(response);
        });
      })
      .on('error', error => {
        reject(error);
      })
      .end());
  }

  _capitalize(s) {
    if (typeof s !== 'string') return ''
    return s.charAt(0).toUpperCase() + s.slice(1)
  }

  _replaceAll(str, obj) {
    return Object.keys(obj).reduce((s, k) => s.replace(new RegExp(k, 'g'), obj[k]), str);
  }
};
