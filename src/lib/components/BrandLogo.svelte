<script lang="ts">
  import brandMark from "$lib/assets/brand-mark.svg"
  let { class: className = "h-8 w-8" }: { class?: string } = $props()
</script>

<span class="brand-logo {className}" aria-hidden="true" style:mask-image={`url("${brandMark}")`} style:-webkit-mask-image={`url("${brandMark}")`}></span>

<style>
  .brand-logo {
    display: block;
    background-color: #000000;
    transition: background-color 150ms ease;
    mask-repeat: no-repeat;
    mask-position: center;
    mask-size: contain;
    -webkit-mask-repeat: no-repeat;
    -webkit-mask-position: center;
    -webkit-mask-size: contain;
  }
  @media (prefers-color-scheme: dark) {
    .brand-logo { background-color: #ffffff; }
  }
  :global(html[data-theme="dark"]) .brand-logo,
  :global(html[data-theme="red"]) .brand-logo {
    background-color: #ffffff;
  }
  :global(html[data-theme="light"]) .brand-logo {
    background-color: #000000;
  }
</style>
