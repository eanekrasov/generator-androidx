@file:Suppress("SpellCheckingInspection", "unused")

import org.gradle.kotlin.dsl.DependencyHandlerScope

<% for (lib of libs) { %>
// <%- lib.url %>
<%- lib.text %>
<% } %>
