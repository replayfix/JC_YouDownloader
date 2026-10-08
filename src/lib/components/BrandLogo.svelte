<script lang="ts">
  import brandMark from "$lib/assets/brand-mark.svg"
  let { class: className = "h-8 w-8" }: { class?: string } = $props()
</script>

<span class="brand-logo {className}" aria-hidden="true" style:mask-image={`url("${brandMark}")`} style:-webkit-mask-image={`url("${brandMark}")`}></span>

<style>
  .brand-logo {
    display: block;
    background-color: currentColor;
    mask-repeat: no-repeat;
    mask-position: center;
    mask-size: contain;
    -webkit-mask-repeat: no-repeat;
    -webkit-mask-position: center;
    -webkit-mask-size: contain;
  }
</style>
