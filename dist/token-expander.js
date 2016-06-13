"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _immutable = require("immutable");

var _enforester = require("./enforester");

var _termExpander = require("./term-expander.js");

var _termExpander2 = _interopRequireDefault(_termExpander);

var _bindingMap = require("./binding-map.js");

var _bindingMap2 = _interopRequireDefault(_bindingMap);

var _env = require("./env");

var _env2 = _interopRequireDefault(_env);

var _shiftReader = require("./shift-reader");

var _shiftReader2 = _interopRequireDefault(_shiftReader);

var _terms = require("./terms");

var _terms2 = _interopRequireDefault(_terms);

var _symbol = require("./symbol");

var _transforms = require("./transforms");

var _errors = require("./errors");

var _loadSyntax = require("./load-syntax");

var _scope = require("./scope");

var _syntax = require("./syntax");

var _syntax2 = _interopRequireDefault(_syntax);

var _astDispatcher = require("./ast-dispatcher");

var _astDispatcher2 = _interopRequireDefault(_astDispatcher);

var _hygieneUtils = require("./hygiene-utils");

var _ramda = require("ramda");

var _ = _interopRequireWildcard(_ramda);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function bindImports_1206(impTerm_1209, exModule_1210, context_1211) {
  let names_1212 = [];
  let phase_1213 = impTerm_1209.forSyntax ? context_1211.phase + 1 : context_1211.phase;
  impTerm_1209.namedImports.forEach(specifier_1214 => {
    let name_1215 = specifier_1214.binding.name;
    let exportName_1216 = findNameInExports_1207(name_1215, exModule_1210.exportEntries);
    if (exportName_1216 != null) {
      let newBinding = (0, _symbol.gensym)(name_1215.val());
      context_1211.store.set(newBinding.toString(), new _transforms.VarBindingTransform(name_1215));
      context_1211.bindings.addForward(name_1215, exportName_1216, newBinding, phase_1213);
      names_1212.push(name_1215);
    }
  });
  return (0, _immutable.List)(names_1212);
}
function findNameInExports_1207(name_1217, exp_1218) {
  let foundNames_1219 = exp_1218.reduce((acc_1220, e_1221) => {
    if ((0, _terms.isExportFrom)(e_1221)) {
      return acc_1220.concat(e_1221.namedExports.reduce((acc_1222, specifier_1223) => {
        if (specifier_1223.exportedName.val() === name_1217.val()) {
          return acc_1222.concat(specifier_1223.exportedName);
        }
        return acc_1222;
      }, (0, _immutable.List)()));
    } else if ((0, _terms.isExport)(e_1221)) {
      return acc_1220.concat(e_1221.declaration.declarators.reduce((acc_1224, decl_1225) => {
        if (decl_1225.binding.name.val() === name_1217.val()) {
          return acc_1224.concat(decl_1225.binding.name);
        }
        return acc_1224;
      }, (0, _immutable.List)()));
    }
    return acc_1220;
  }, (0, _immutable.List)());
  (0, _errors.assert)(foundNames_1219.size <= 1, "expecting no more than 1 matching name in exports");
  return foundNames_1219.get(0);
}
function removeNames_1208(impTerm_1226, names_1227) {
  let namedImports_1228 = impTerm_1226.namedImports.filter(specifier_1229 => !names_1227.contains(specifier_1229.binding.name));
  return impTerm_1226.extend({ namedImports: namedImports_1228 });
}
class TokenExpander extends _astDispatcher2.default {
  constructor(context_1230) {
    super("expand", false);
    this.context = context_1230;
  }
  expand(stxl_1231) {
    let result_1232 = [];
    if (stxl_1231.size === 0) {
      return (0, _immutable.List)(result_1232);
    }
    let prev_1233 = (0, _immutable.List)();
    let enf_1234 = new _enforester.Enforester(stxl_1231, prev_1233, this.context);
    while (!enf_1234.done) {
      result_1232.push(this.dispatch(enf_1234.enforest()));
    }
    return (0, _immutable.List)(result_1232);
  }
  expandVariableDeclarationStatement(term_1235) {
    return term_1235.extend({ declaration: this.registerVariableDeclaration(term_1235.declaration) });
  }
  expandFunctionDeclaration(term_1236) {
    let registeredTerm_1237 = this.registerFunctionOrClass(term_1236);
    let stx_1238 = registeredTerm_1237.name.name;
    this.context.env.set(stx_1238.resolve(this.context.phase), new _transforms.VarBindingTransform(stx_1238));
    return registeredTerm_1237;
  }
  expandImport(term_1239) {
    let path_1240 = term_1239.moduleSpecifier.val();
    let mod_1241;
    if (term_1239.forSyntax) {
      mod_1241 = this.context.modules.getAtPhase(path_1240, this.context.phase + 1, this.context.cwd);
      this.context.store = this.context.modules.visit(mod_1241, this.context.phase + 1, this.context.store);
      this.context.store = this.context.modules.invoke(mod_1241, this.context.phase + 1, this.context.store);
    } else {
      mod_1241 = this.context.modules.getAtPhase(path_1240, this.context.phase, this.context.cwd);
      this.context.store = this.context.modules.visit(mod_1241, this.context.phase, this.context.store);
    }
    let boundNames_1242 = bindImports_1206(term_1239, mod_1241, this.context);
    return removeNames_1208(term_1239, boundNames_1242);
  }
  expandExport(term_1243) {
    if ((0, _terms.isFunctionDeclaration)(term_1243.declaration) || (0, _terms.isClassDeclaration)(term_1243.declaration)) {
      return term_1243.extend({ declaration: this.registerFunctionOrClass(term_1243.declaration) });
    } else if ((0, _terms.isVariableDeclaration)(term_1243.declaration)) {
      return term_1243.extend({ declaration: this.registerVariableDeclaration(term_1243.declaration) });
    }
    return term_1243;
  }
  registerFunctionOrClass(term_1244) {
    let name_1245 = term_1244.name.removeScope(this.context.useScope, this.context.phase);
    (0, _hygieneUtils.collectBindings)(term_1244.name).forEach(stx_1246 => {
      let newBinding_1247 = (0, _symbol.gensym)(stx_1246.val());
      this.context.bindings.add(stx_1246, { binding: newBinding_1247, phase: this.context.phase, skipDup: false });
      this.context.env.set(newBinding_1247.toString(), new _transforms.VarBindingTransform(stx_1246));
    });
    return term_1244.extend({ name: name_1245 });
  }
  registerVariableDeclaration(term_1248) {
    if ((0, _terms.isSyntaxDeclaration)(term_1248) || (0, _terms.isSyntaxrecDeclaration)(term_1248)) {
      return this.registerSyntaxDeclaration(term_1248);
    }
    return term_1248.extend({ declarators: term_1248.declarators.map(decl_1249 => {
        let binding_1250 = decl_1249.binding.removeScope(this.context.useScope, this.context.phase);
        (0, _hygieneUtils.collectBindings)(binding_1250).forEach(stx_1251 => {
          let newBinding_1252 = (0, _symbol.gensym)(stx_1251.val());
          this.context.bindings.add(stx_1251, { binding: newBinding_1252, phase: this.context.phase, skipDup: term_1248.kind === "var" });
          this.context.env.set(newBinding_1252.toString(), new _transforms.VarBindingTransform(stx_1251));
        });
        return decl_1249.extend({ binding: binding_1250 });
      }) });
  }
  registerSyntaxDeclaration(term_1253) {
    if ((0, _terms.isSyntaxDeclaration)(term_1253)) {
      let scope = (0, _scope.freshScope)("nonrec");
      term_1253 = term_1253.extend({ declarators: term_1253.declarators.map(decl_1254 => {
          let name_1255 = decl_1254.binding.name;
          let nameAdded_1256 = name_1255.addScope(scope, this.context.bindings, _syntax.ALL_PHASES);
          let nameRemoved_1257 = name_1255.removeScope(this.context.currentScope[this.context.currentScope.length - 1], this.context.phase);
          let newBinding_1258 = (0, _symbol.gensym)(name_1255.val());
          this.context.bindings.addForward(nameAdded_1256, nameRemoved_1257, newBinding_1258, this.context.phase);
          return decl_1254.extend({ init: decl_1254.init.addScope(scope, this.context.bindings, _syntax.ALL_PHASES) });
        }) });
    }
    return term_1253.extend({ declarators: term_1253.declarators.map(decl_1259 => {
        let binding_1260 = decl_1259.binding.removeScope(this.context.useScope, this.context.phase);
        let syntaxExpander_1261 = new _termExpander2.default(_.merge(this.context, { phase: this.context.phase + 1, env: new _env2.default(), store: this.context.store }));
        let init_1262 = syntaxExpander_1261.expand(decl_1259.init);
        let val_1263 = (0, _loadSyntax.evalCompiletimeValue)(init_1262.gen(), _.merge(this.context, { phase: this.context.phase + 1 }));
        (0, _hygieneUtils.collectBindings)(binding_1260).forEach(stx_1264 => {
          let newBinding_1265 = (0, _symbol.gensym)(stx_1264.val());
          this.context.bindings.add(stx_1264, { binding: newBinding_1265, phase: this.context.phase, skipDup: false });
          let resolvedName_1266 = stx_1264.resolve(this.context.phase);
          this.context.env.set(resolvedName_1266, new _transforms.CompiletimeTransform(val_1263));
        });
        return decl_1259.extend({ binding: binding_1260, init: init_1262 });
      }) });
  }
}
exports.default = TokenExpander;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3N3ZWV0L3Rva2VuLWV4cGFuZGVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBOztBQUNBOztBQUNBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7O0FBQ0E7O0lBQWEsQzs7Ozs7O0FBQ2IsU0FBUyxnQkFBVCxDQUEwQixZQUExQixFQUF3QyxhQUF4QyxFQUF1RCxZQUF2RCxFQUFxRTtBQUNuRSxNQUFJLGFBQWEsRUFBakI7QUFDQSxNQUFJLGFBQWEsYUFBYSxTQUFiLEdBQXlCLGFBQWEsS0FBYixHQUFxQixDQUE5QyxHQUFrRCxhQUFhLEtBQWhGO0FBQ0EsZUFBYSxZQUFiLENBQTBCLE9BQTFCLENBQWtDLGtCQUFrQjtBQUNsRCxRQUFJLFlBQVksZUFBZSxPQUFmLENBQXVCLElBQXZDO0FBQ0EsUUFBSSxrQkFBa0IsdUJBQXVCLFNBQXZCLEVBQWtDLGNBQWMsYUFBaEQsQ0FBdEI7QUFDQSxRQUFJLG1CQUFtQixJQUF2QixFQUE2QjtBQUMzQixVQUFJLGFBQWEsb0JBQU8sVUFBVSxHQUFWLEVBQVAsQ0FBakI7QUFDQSxtQkFBYSxLQUFiLENBQW1CLEdBQW5CLENBQXVCLFdBQVcsUUFBWCxFQUF2QixFQUE4QyxvQ0FBd0IsU0FBeEIsQ0FBOUM7QUFDQSxtQkFBYSxRQUFiLENBQXNCLFVBQXRCLENBQWlDLFNBQWpDLEVBQTRDLGVBQTVDLEVBQTZELFVBQTdELEVBQXlFLFVBQXpFO0FBQ0EsaUJBQVcsSUFBWCxDQUFnQixTQUFoQjtBQUNEO0FBQ0YsR0FURDtBQVVBLFNBQU8scUJBQUssVUFBTCxDQUFQO0FBQ0Q7QUFDRCxTQUFTLHNCQUFULENBQWdDLFNBQWhDLEVBQTJDLFFBQTNDLEVBQXFEO0FBQ25ELE1BQUksa0JBQWtCLFNBQVMsTUFBVCxDQUFnQixDQUFDLFFBQUQsRUFBVyxNQUFYLEtBQXNCO0FBQzFELFFBQUks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QUFJLGtCQUFrQixvQkFBTyxTQUFTLEdBQVQsRUFBUCxDQUF0QjtBQUNBLGVBQUssT0FBTCxDQUFhLFFBQWIsQ0FBc0IsR0FBdEIsQ0FBMEIsUUFBMUIsRUFBb0MsRUFBQyxTQUFTLGVBQVYsRUFBMkIsT0FBTyxLQUFLLE9BQUwsQ0FBYSxLQUEvQyxFQUFzRCxTQUFTLEtBQS9ELEVBQXBDO0FBQ0EsY0FBSSxvQkFBb0IsU0FBUyxPQUFULENBQWlCLEtBQUssT0FBTCxDQUFhLEtBQTlCLENBQXhCO0FBQ0EsZUFBSyxPQUFMLENBQWEsR0FBYixDQUFpQixHQUFqQixDQUFxQixpQkFBckIsRUFBd0MscUNBQXlCLFFBQXpCLENBQXhDO0FBQ0QsU0FMRDtBQU1BLGVBQU8sVUFBVSxNQUFWLENBQWlCLEVBQUMsU0FBUyxZQUFWLEVBQXdCLE1BQU0sU0FBOUIsRUFBakIsQ0FBUDtBQUNELE9BWnFDLENBQWQsRUFBakIsQ0FBUDtBQWFEO0FBaEdzRDtrQkFBcEMsYSIsImZpbGUiOiJ0b2tlbi1leHBhbmRlci5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7TGlzdH0gZnJvbSBcImltbXV0YWJsZVwiO1xuaW1wb3J0IHtlbmZvcmVzdEV4cHIsIEVuZm9yZXN0ZXJ9IGZyb20gXCIuL2VuZm9yZXN0ZXJcIjtcbmltcG9ydCBUZXJtRXhwYW5kZXIgZnJvbSBcIi4vdGVybS1leHBhbmRlci5qc1wiO1xuaW1wb3J0IEJpbmRpbmdNYXAgZnJvbSBcIi4vYmluZGluZy1tYXAuanNcIjtcbmltcG9ydCBFbnYgZnJvbSBcIi4vZW52XCI7XG5pbXBvcnQgUmVhZGVyIGZyb20gXCIuL3NoaWZ0LXJlYWRlclwiO1xuaW1wb3J0IFRlcm0sIHtpc0VPRiwgaXNCaW5kaW5nSWRlbnRpZmllciwgaXNCaW5kaW5nUHJvcGVydHlQcm9wZXJ0eSwgaXNCaW5kaW5nUHJvcGVydHlJZGVudGlmaWVyLCBpc09iamVjdEJpbmRpbmcsIGlzQXJyYXlCaW5kaW5nLCBpc0Z1bmN0aW9uRGVjbGFyYXRpb24sIGlzRnVuY3Rpb25FeHByZXNzaW9uLCBpc0Z1bmN0aW9uVGVybSwgaXNGdW5jdGlvbldpdGhOYW1lLCBpc1N5bnRheERlY2xhcmF0aW9uLCBpc1N5bnRheHJlY0RlY2xhcmF0aW9uLCBpc1ZhcmlhYmxlRGVjbGFyYXRpb24sIGlzVmFyaWFibGVEZWNsYXJhdGlvblN0YXRlbWVudCwgaXNJbXBvcnQsIGlzRXhwb3J0LCBpc0V4cG9ydEZyb20sIGlzUHJhZ21hLCBpc0V4cG9ydFN5bnRheCwgaXNDbGFzc0RlY2xhcmF0aW9ufSBmcm9tIFwiLi90ZXJtc1wiO1xuaW1wb3J0IHtnZW5zeW19IGZyb20gXCIuL3N5bWJvbFwiO1xuaW1wb3J0IHtWYXJCaW5kaW5nVHJhbnNmb3JtLCBDb21waWxldGltZVRyYW5zZm9ybX0gZnJvbSBcIi4vdHJhbnNmb3Jtc1wiO1xuaW1wb3J0IHtleHBlY3QsIGFzc2VydH0gZnJvbSBcIi4vZXJyb3JzXCI7XG5pbXBvcnQge2V2YWxDb21waWxldGltZVZhbHVlfSBmcm9tIFwiLi9sb2FkLXN5bnRheFwiO1xuaW1wb3J0IHtTY29wZSwgZnJlc2hTY29wZX0gZnJvbSBcIi4vc2NvcGVcIjtcbmltcG9ydCBTeW50YXgsIHtBTExfUEhBU0VTfSBmcm9tIFwiLi9zeW50YXhcIjtcbmltcG9ydCBBU1REaXNwYXRjaGVyIGZyb20gXCIuL2FzdC1kaXNwYXRjaGVyXCI7XG5pbXBvcnQge2NvbGxlY3RCaW5kaW5nc30gZnJvbSBcIi4vaHlnaWVuZS11dGlsc1wiO1xuaW1wb3J0ICAqIGFzIF8gZnJvbSBcInJhbWRhXCI7XG5mdW5jdGlvbiBiaW5kSW1wb3J0c18xMjA2KGltcFRlcm1fMTIwOSwgZXhNb2R1bGVfMTIxMCwgY29udGV4dF8xMjExKSB7XG4gIGxldCBuYW1lc18xMjEyID0gW107XG4gIGxldCBwaGFzZV8xMjEzID0gaW1wVGVybV8xMjA5LmZvclN5bnRheCA/IGNvbnRleHRfMTIxMS5waGFzZSArIDEgOiBjb250ZXh0XzEyMTEucGhhc2U7XG4gIGltcFRlcm1fMTIwOS5uYW1lZEltcG9ydHMuZm9yRWFjaChzcGVjaWZpZXJfMTIxNCA9PiB7XG4gICAgbGV0IG5hbWVfMTIxNSA9IHNwZWNpZmllcl8xMjE0LmJpbmRpbmcubmFtZTtcbiAgICBsZXQgZXhwb3J0TmFtZV8xMjE2ID0gZmluZE5hbWVJbkV4cG9ydHNfMTIwNyhuYW1lXzEyMTUsIGV4TW9kdWxlXzEyMTAuZXhwb3J0RW50cmllcyk7XG4gICAgaWYgKGV4cG9ydE5hbWVfMTIxNiAhPSBudWxsKSB7XG4gICAgICBsZXQgbmV3QmluZGluZyA9IGdlbnN5bShuYW1lXzEyMTUudmFsKCkpO1xuICAgICAgY29udGV4dF8xMjExLnN0b3JlLnNldChuZXdCaW5kaW5nLnRvU3RyaW5nKCksIG5ldyBWYXJCaW5kaW5nVHJhbnNmb3JtKG5hbWVfMTIxNSkpO1xuICAgICAgY29udGV4dF8xMjExLmJpbmRpbmdzLmFkZEZvcndhcmQobmFtZV8xMjE1LCBleHBvcnROYW1lXzEyMTYsIG5ld0JpbmRpbmcsIHBoYXNlXzEyMTMpO1xuICAgICAgbmFtZXNfMTIxMi5wdXNoKG5hbWVfMTIxNSk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIExpc3QobmFtZXNfMTIxMik7XG59XG5mdW5jdGlvbiBmaW5kTmFtZUluRXhwb3J0c18xMjA3KG5hbWVfMTIxNywgZXhwXzEyMTgpIHtcbiAgbGV0IGZvdW5kTmFtZXNfMTIxOSA9IGV4cF8xMjE4LnJlZHVjZSgoYWNjXzEyMjAsIGVfMTIyMSkgPT4ge1xuICAgIGlmIChpc0V4cG9ydEZyb20oZV8xMjIxKSkge1xuICAgICAgcmV0dXJuIGFjY18xMjIwLmNvbmNhdChlXzEyMjEubmFtZWRFeHBvcnRzLnJlZHVjZSgoYWNjXzEyMjIsIHNwZWNpZmllcl8xMjIzKSA9PiB7XG4gICAgICAgIGlmIChzcGVjaWZpZXJfMTIyMy5leHBvcnRlZE5hbWUudmFsKCkgPT09IG5hbWVfMTIxNy52YWwoKSkge1xuICAgICAgICAgIHJldHVybiBhY2NfMTIyMi5jb25jYXQoc3BlY2lmaWVyXzEyMjMuZXhwb3J0ZWROYW1lKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYWNjXzEyMjI7XG4gICAgICB9LCBMaXN0KCkpKTtcbiAgICB9IGVsc2UgaWYgKGlzRXhwb3J0KGVfMTIyMSkpIHtcbiAgICAgIHJldHVybiBhY2NfMTIyMC5jb25jYXQoZV8xMjIxLmRlY2xhcmF0aW9uLmRlY2xhcmF0b3JzLnJlZHVjZSgoYWNjXzEyMjQsIGRlY2xfMTIyNSkgPT4ge1xuICAgICAgICBpZiAoZGVjbF8xMjI1LmJpbmRpbmcubmFtZS52YWwoKSA9PT0gbmFtZV8xMjE3LnZhbCgpKSB7XG4gICAgICAgICAgcmV0dXJuIGFjY18xMjI0LmNvbmNhdChkZWNsXzEyMjUuYmluZGluZy5uYW1lKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYWNjXzEyMjQ7XG4gICAgICB9LCBMaXN0KCkpKTtcbiAgICB9XG4gICAgcmV0dXJuIGFjY18xMjIwO1xuICB9LCBMaXN0KCkpO1xuICBhc3NlcnQoZm91bmROYW1lc18xMjE5LnNpemUgPD0gMSwgXCJleHBlY3Rpbmcgbm8gbW9yZSB0aGFuIDEgbWF0Y2hpbmcgbmFtZSBpbiBleHBvcnRzXCIpO1xuICByZXR1cm4gZm91bmROYW1lc18xMjE5LmdldCgwKTtcbn1cbmZ1bmN0aW9uIHJlbW92ZU5hbWVzXzEyMDgoaW1wVGVybV8xMjI2LCBuYW1lc18xMjI3KSB7XG4gIGxldCBuYW1lZEltcG9ydHNfMTIyOCA9IGltcFRlcm1fMTIyNi5uYW1lZEltcG9ydHMuZmlsdGVyKHNwZWNpZmllcl8xMjI5ID0+ICFuYW1lc18xMjI3LmNvbnRhaW5zKHNwZWNpZmllcl8xMjI5LmJpbmRpbmcubmFtZSkpO1xuICByZXR1cm4gaW1wVGVybV8xMjI2LmV4dGVuZCh7bmFtZWRJbXBvcnRzOiBuYW1lZEltcG9ydHNfMTIyOH0pO1xufVxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVG9rZW5FeHBhbmRlciBleHRlbmRzIEFTVERpc3BhdGNoZXIge1xuICBjb25zdHJ1Y3Rvcihjb250ZXh0XzEyMzApIHtcbiAgICBzdXBlcihcImV4cGFuZFwiLCBmYWxzZSk7XG4gICAgdGhpcy5jb250ZXh0ID0gY29udGV4dF8xMjMwO1xuICB9XG4gIGV4cGFuZChzdHhsXzEyMzEpIHtcbiAgICBsZXQgcmVzdWx0XzEyMzIgPSBbXTtcbiAgICBpZiAoc3R4bF8xMjMxLnNpemUgPT09IDApIHtcbiAgICAgIHJldHVybiBMaXN0KHJlc3VsdF8xMjMyKTtcbiAgICB9XG4gICAgbGV0IHByZXZfMTIzMyA9IExpc3QoKTtcbiAgICBsZXQgZW5mXzEyMzQgPSBuZXcgRW5mb3Jlc3RlcihzdHhsXzEyMzEsIHByZXZfMTIzMywgdGhpcy5jb250ZXh0KTtcbiAgICB3aGlsZSAoIWVuZl8xMjM0LmRvbmUpIHtcbiAgICAgIHJlc3VsdF8xMjMyLnB1c2godGhpcy5kaXNwYXRjaChlbmZfMTIzNC5lbmZvcmVzdCgpKSk7XG4gICAgfVxuICAgIHJldHVybiBMaXN0KHJlc3VsdF8xMjMyKTtcbiAgfVxuICBleHBhbmRWYXJpYWJsZURlY2xhcmF0aW9uU3RhdGVtZW50KHRlcm1fMTIzNSkge1xuICAgIHJldHVybiB0ZXJtXzEyMzUuZXh0ZW5kKHtkZWNsYXJhdGlvbjogdGhpcy5yZWdpc3RlclZhcmlhYmxlRGVjbGFyYXRpb24odGVybV8xMjM1LmRlY2xhcmF0aW9uKX0pO1xuICB9XG4gIGV4cGFuZEZ1bmN0aW9uRGVjbGFyYXRpb24odGVybV8xMjM2KSB7XG4gICAgbGV0IHJlZ2lzdGVyZWRUZXJtXzEyMzcgPSB0aGlzLnJlZ2lzdGVyRnVuY3Rpb25PckNsYXNzKHRlcm1fMTIzNik7XG4gICAgbGV0IHN0eF8xMjM4ID0gcmVnaXN0ZXJlZFRlcm1fMTIzNy5uYW1lLm5hbWU7XG4gICAgdGhpcy5jb250ZXh0LmVudi5zZXQoc3R4XzEyMzgucmVzb2x2ZSh0aGlzLmNvbnRleHQucGhhc2UpLCBuZXcgVmFyQmluZGluZ1RyYW5zZm9ybShzdHhfMTIzOCkpO1xuICAgIHJldHVybiByZWdpc3RlcmVkVGVybV8xMjM3O1xuICB9XG4gIGV4cGFuZEltcG9ydCh0ZXJtXzEyMzkpIHtcbiAgICBsZXQgcGF0aF8xMjQwID0gdGVybV8xMjM5Lm1vZHVsZVNwZWNpZmllci52YWwoKTtcbiAgICBsZXQgbW9kXzEyNDE7XG4gICAgaWYgKHRlcm1fMTIzOS5mb3JTeW50YXgpIHtcbiAgICAgIG1vZF8xMjQxID0gdGhpcy5jb250ZXh0Lm1vZHVsZXMuZ2V0QXRQaGFzZShwYXRoXzEyNDAsIHRoaXMuY29udGV4dC5waGFzZSArIDEsIHRoaXMuY29udGV4dC5jd2QpO1xuICAgICAgdGhpcy5jb250ZXh0LnN0b3JlID0gdGhpcy5jb250ZXh0Lm1vZHVsZXMudmlzaXQobW9kXzEyNDEsIHRoaXMuY29udGV4dC5waGFzZSArIDEsIHRoaXMuY29udGV4dC5zdG9yZSk7XG4gICAgICB0aGlzLmNvbnRleHQuc3RvcmUgPSB0aGlzLmNvbnRleHQubW9kdWxlcy5pbnZva2UobW9kXzEyNDEsIHRoaXMuY29udGV4dC5waGFzZSArIDEsIHRoaXMuY29udGV4dC5zdG9yZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG1vZF8xMjQxID0gdGhpcy5jb250ZXh0Lm1vZHVsZXMuZ2V0QXRQaGFzZShwYXRoXzEyNDAsIHRoaXMuY29udGV4dC5waGFzZSwgdGhpcy5jb250ZXh0LmN3ZCk7XG4gICAgICB0aGlzLmNvbnRleHQuc3RvcmUgPSB0aGlzLmNvbnRleHQubW9kdWxlcy52aXNpdChtb2RfMTI0MSwgdGhpcy5jb250ZXh0LnBoYXNlLCB0aGlzLmNvbnRleHQuc3RvcmUpO1xuICAgIH1cbiAgICBsZXQgYm91bmROYW1lc18xMjQyID0gYmluZEltcG9ydHNfMTIwNih0ZXJtXzEyMzksIG1vZF8xMjQxLCB0aGlzLmNvbnRleHQpO1xuICAgIHJldHVybiByZW1vdmVOYW1lc18xMjA4KHRlcm1fMTIzOSwgYm91bmROYW1lc18xMjQyKTtcbiAgfVxuICBleHBhbmRFeHBvcnQodGVybV8xMjQzKSB7XG4gICAgaWYgKGlzRnVuY3Rpb25EZWNsYXJhdGlvbih0ZXJtXzEyNDMuZGVjbGFyYXRpb24pIHx8IGlzQ2xhc3NEZWNsYXJhdGlvbih0ZXJtXzEyNDMuZGVjbGFyYXRpb24pKSB7XG4gICAgICByZXR1cm4gdGVybV8xMjQzLmV4dGVuZCh7ZGVjbGFyYXRpb246IHRoaXMucmVnaXN0ZXJGdW5jdGlvbk9yQ2xhc3ModGVybV8xMjQzLmRlY2xhcmF0aW9uKX0pO1xuICAgIH0gZWxzZSBpZiAoaXNWYXJpYWJsZURlY2xhcmF0aW9uKHRlcm1fMTI0My5kZWNsYXJhdGlvbikpIHtcbiAgICAgIHJldHVybiB0ZXJtXzEyNDMuZXh0ZW5kKHtkZWNsYXJhdGlvbjogdGhpcy5yZWdpc3RlclZhcmlhYmxlRGVjbGFyYXRpb24odGVybV8xMjQzLmRlY2xhcmF0aW9uKX0pO1xuICAgIH1cbiAgICByZXR1cm4gdGVybV8xMjQzO1xuICB9XG4gIHJlZ2lzdGVyRnVuY3Rpb25PckNsYXNzKHRlcm1fMTI0NCkge1xuICAgIGxldCBuYW1lXzEyNDUgPSB0ZXJtXzEyNDQubmFtZS5yZW1vdmVTY29wZSh0aGlzLmNvbnRleHQudXNlU2NvcGUsIHRoaXMuY29udGV4dC5waGFzZSk7XG4gICAgY29sbGVjdEJpbmRpbmdzKHRlcm1fMTI0NC5uYW1lKS5mb3JFYWNoKHN0eF8xMjQ2ID0+IHtcbiAgICAgIGxldCBuZXdCaW5kaW5nXzEyNDcgPSBnZW5zeW0oc3R4XzEyNDYudmFsKCkpO1xuICAgICAgdGhpcy5jb250ZXh0LmJpbmRpbmdzLmFkZChzdHhfMTI0Niwge2JpbmRpbmc6IG5ld0JpbmRpbmdfMTI0NywgcGhhc2U6IHRoaXMuY29udGV4dC5waGFzZSwgc2tpcER1cDogZmFsc2V9KTtcbiAgICAgIHRoaXMuY29udGV4dC5lbnYuc2V0KG5ld0JpbmRpbmdfMTI0Ny50b1N0cmluZygpLCBuZXcgVmFyQmluZGluZ1RyYW5zZm9ybShzdHhfMTI0NikpO1xuICAgIH0pO1xuICAgIHJldHVybiB0ZXJtXzEyNDQuZXh0ZW5kKHtuYW1lOiBuYW1lXzEyNDV9KTtcbiAgfVxuICByZWdpc3RlclZhcmlhYmxlRGVjbGFyYXRpb24odGVybV8xMjQ4KSB7XG4gICAgaWYgKGlzU3ludGF4RGVjbGFyYXRpb24odGVybV8xMjQ4KSB8fCBpc1N5bnRheHJlY0RlY2xhcmF0aW9uKHRlcm1fMTI0OCkpIHtcbiAgICAgIHJldHVybiB0aGlzLnJlZ2lzdGVyU3ludGF4RGVjbGFyYXRpb24odGVybV8xMjQ4KTtcbiAgICB9XG4gICAgcmV0dXJuIHRlcm1fMTI0OC5leHRlbmQoe2RlY2xhcmF0b3JzOiB0ZXJtXzEyNDguZGVjbGFyYXRvcnMubWFwKGRlY2xfMTI0OSA9PiB7XG4gICAgICBsZXQgYmluZGluZ18xMjUwID0gZGVjbF8xMjQ5LmJpbmRpbmcucmVtb3ZlU2NvcGUodGhpcy5jb250ZXh0LnVzZVNjb3BlLCB0aGlzLmNvbnRleHQucGhhc2UpO1xuICAgICAgY29sbGVjdEJpbmRpbmdzKGJpbmRpbmdfMTI1MCkuZm9yRWFjaChzdHhfMTI1MSA9PiB7XG4gICAgICAgIGxldCBuZXdCaW5kaW5nXzEyNTIgPSBnZW5zeW0oc3R4XzEyNTEudmFsKCkpO1xuICAgICAgICB0aGlzLmNvbnRleHQuYmluZGluZ3MuYWRkKHN0eF8xMjUxLCB7YmluZGluZzogbmV3QmluZGluZ18xMjUyLCBwaGFzZTogdGhpcy5jb250ZXh0LnBoYXNlLCBza2lwRHVwOiB0ZXJtXzEyNDgua2luZCA9PT0gXCJ2YXJcIn0pO1xuICAgICAgICB0aGlzLmNvbnRleHQuZW52LnNldChuZXdCaW5kaW5nXzEyNTIudG9TdHJpbmcoKSwgbmV3IFZhckJpbmRpbmdUcmFuc2Zvcm0oc3R4XzEyNTEpKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIGRlY2xfMTI0OS5leHRlbmQoe2JpbmRpbmc6IGJpbmRpbmdfMTI1MH0pO1xuICAgIH0pfSk7XG4gIH1cbiAgcmVnaXN0ZXJTeW50YXhEZWNsYXJhdGlvbih0ZXJtXzEyNTMpIHtcbiAgICBpZiAoaXNTeW50YXhEZWNsYXJhdGlvbih0ZXJtXzEyNTMpKSB7XG4gICAgICBsZXQgc2NvcGUgPSBmcmVzaFNjb3BlKFwibm9ucmVjXCIpO1xuICAgICAgdGVybV8xMjUzID0gdGVybV8xMjUzLmV4dGVuZCh7ZGVjbGFyYXRvcnM6IHRlcm1fMTI1My5kZWNsYXJhdG9ycy5tYXAoZGVjbF8xMjU0ID0+IHtcbiAgICAgICAgbGV0IG5hbWVfMTI1NSA9IGRlY2xfMTI1NC5iaW5kaW5nLm5hbWU7XG4gICAgICAgIGxldCBuYW1lQWRkZWRfMTI1NiA9IG5hbWVfMTI1NS5hZGRTY29wZShzY29wZSwgdGhpcy5jb250ZXh0LmJpbmRpbmdzLCBBTExfUEhBU0VTKTtcbiAgICAgICAgbGV0IG5hbWVSZW1vdmVkXzEyNTcgPSBuYW1lXzEyNTUucmVtb3ZlU2NvcGUodGhpcy5jb250ZXh0LmN1cnJlbnRTY29wZVt0aGlzLmNvbnRleHQuY3VycmVudFNjb3BlLmxlbmd0aCAtIDFdLCB0aGlzLmNvbnRleHQucGhhc2UpO1xuICAgICAgICBsZXQgbmV3QmluZGluZ18xMjU4ID0gZ2Vuc3ltKG5hbWVfMTI1NS52YWwoKSk7XG4gICAgICAgIHRoaXMuY29udGV4dC5iaW5kaW5ncy5hZGRGb3J3YXJkKG5hbWVBZGRlZF8xMjU2LCBuYW1lUmVtb3ZlZF8xMjU3LCBuZXdCaW5kaW5nXzEyNTgsIHRoaXMuY29udGV4dC5waGFzZSk7XG4gICAgICAgIHJldHVybiBkZWNsXzEyNTQuZXh0ZW5kKHtpbml0OiBkZWNsXzEyNTQuaW5pdC5hZGRTY29wZShzY29wZSwgdGhpcy5jb250ZXh0LmJpbmRpbmdzLCBBTExfUEhBU0VTKX0pO1xuICAgICAgfSl9KTtcbiAgICB9XG4gICAgcmV0dXJuIHRlcm1fMTI1My5leHRlbmQoe2RlY2xhcmF0b3JzOiB0ZXJtXzEyNTMuZGVjbGFyYXRvcnMubWFwKGRlY2xfMTI1OSA9PiB7XG4gICAgICBsZXQgYmluZGluZ18xMjYwID0gZGVjbF8xMjU5LmJpbmRpbmcucmVtb3ZlU2NvcGUodGhpcy5jb250ZXh0LnVzZVNjb3BlLCB0aGlzLmNvbnRleHQucGhhc2UpO1xuICAgICAgbGV0IHN5bnRheEV4cGFuZGVyXzEyNjEgPSBuZXcgVGVybUV4cGFuZGVyKF8ubWVyZ2UodGhpcy5jb250ZXh0LCB7cGhhc2U6IHRoaXMuY29udGV4dC5waGFzZSArIDEsIGVudjogbmV3IEVudiwgc3RvcmU6IHRoaXMuY29udGV4dC5zdG9yZX0pKTtcbiAgICAgIGxldCBpbml0XzEyNjIgPSBzeW50YXhFeHBhbmRlcl8xMjYxLmV4cGFuZChkZWNsXzEyNTkuaW5pdCk7XG4gICAgICBsZXQgdmFsXzEyNjMgPSBldmFsQ29tcGlsZXRpbWVWYWx1ZShpbml0XzEyNjIuZ2VuKCksIF8ubWVyZ2UodGhpcy5jb250ZXh0LCB7cGhhc2U6IHRoaXMuY29udGV4dC5waGFzZSArIDF9KSk7XG4gICAgICBjb2xsZWN0QmluZGluZ3MoYmluZGluZ18xMjYwKS5mb3JFYWNoKHN0eF8xMjY0ID0+IHtcbiAgICAgICAgbGV0IG5ld0JpbmRpbmdfMTI2NSA9IGdlbnN5bShzdHhfMTI2NC52YWwoKSk7XG4gICAgICAgIHRoaXMuY29udGV4dC5iaW5kaW5ncy5hZGQoc3R4XzEyNjQsIHtiaW5kaW5nOiBuZXdCaW5kaW5nXzEyNjUsIHBoYXNlOiB0aGlzLmNvbnRleHQucGhhc2UsIHNraXBEdXA6IGZhbHNlfSk7XG4gICAgICAgIGxldCByZXNvbHZlZE5hbWVfMTI2NiA9IHN0eF8xMjY0LnJlc29sdmUodGhpcy5jb250ZXh0LnBoYXNlKTtcbiAgICAgICAgdGhpcy5jb250ZXh0LmVudi5zZXQocmVzb2x2ZWROYW1lXzEyNjYsIG5ldyBDb21waWxldGltZVRyYW5zZm9ybSh2YWxfMTI2MykpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gZGVjbF8xMjU5LmV4dGVuZCh7YmluZGluZzogYmluZGluZ18xMjYwLCBpbml0OiBpbml0XzEyNjJ9KTtcbiAgICB9KX0pO1xuICB9XG59XG4iXX0=