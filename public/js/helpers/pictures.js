// <img data-fallback="..."> swaps to the fallback if the first picture fails,
// for example a film with no backdrop. It gets the class "is-fallback".
export function wireFallbacks(root) {
    for (const image of root.querySelectorAll('img[data-fallback]')) {
        const swap = () => useFallback(image);
        image.addEventListener('error', swap, { once: true });
        const hasFailed = image.complete && image.naturalWidth === 0;
        if (hasFailed) {
            swap();
        }
    }
}

function useFallback(image) {
    const fallback = image.dataset.fallback;
    if (!fallback || image.src.endsWith(fallback)) {
        return;
    }
    image.classList.add('is-fallback');
    image.src = fallback;
}
