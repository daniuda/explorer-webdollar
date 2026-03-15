<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-dot" />
        <div>
          <p class="brand-title">WebDollar Explorer</p>
          <p class="brand-subtitle">Next UI</p>
        </div>
      </div>

      <nav class="nav-links">
        <RouterLink to="/" class="nav-link">Dashboard</RouterLink>
        <RouterLink to="/blocks" class="nav-link">Blocks</RouterLink>
        <RouterLink to="/transactions" class="nav-link">Transactions</RouterLink>
        <RouterLink to="/address" class="nav-link">Address</RouterLink>
        <RouterLink to="/pools" class="nav-link">Pools</RouterLink>
        <RouterLink to="/network" class="nav-link">Network</RouterLink>
      </nav>
    </aside>

    <main class="content">
      <RouterView />
    </main>
  </div>
</template>
