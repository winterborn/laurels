// Edit grammar for the page: a cut by default, a few marked moments.
// Timings and the curve come from the tokens on :root in app.css.

const ANIMATED_KEY = 'laurels.animated';

export function prefersStill() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// True the first time a key is asked for in this browser tab session.
export function onceThisVisit(key) {
    try {
        const done = new Set(JSON.parse(sessionStorage.getItem(ANIMATED_KEY) ?? '[]'));
        if (done.has(key)) {
            return false;
        }
        done.add(key);
        sessionStorage.setItem(ANIMATED_KEY, JSON.stringify([...done]));
        return true;
    } catch {
        return false;
    }
}

// The unlock popup opens like an iris on a silent film.
export function irisIn(element) {
    play(element, [
        {
            clipPath: 'circle(0% at 50% 50%)',
        },
        {
            clipPath: 'circle(75% at 50% 50%)',
        },
    ], '--iris');
}

export function dissolveIn(element) {
    play(element, [
        {
            opacity: 0,
        },
        {
            opacity: 1,
        },
    ], '--dissolve');
}

// A new poster comes up from a pale grey print to full colour.
export function developPrint(image) {
    play(image, [
        {
            filter: 'grayscale(1) brightness(1.6) contrast(0.6)',
        },
        {
            filter: 'none',
        },
    ], '--develop');
}

// Meters run from zero to their value.
export function runMeters(root) {
    for (const fill of root.querySelectorAll('.meter-fill')) {
        play(fill, [
            {
                transform: 'scaleX(0)',
            },
            {
                transform: 'scaleX(1)',
            },
        ], '--scrub');
    }
    for (const head of root.querySelectorAll('.meter-head')) {
        play(head, [
            {
                opacity: 0,
            },
            {
                opacity: 1,
            },
        ], '--scrub');
    }
}

function play(element, frames, durationToken) {
    if (!element || prefersStill()) {
        return;
    }
    element.animate(frames, {
        duration: durationOf(durationToken),
        easing: tokenOf('--ease-film'),
        fill: 'backwards',
    });
}

function durationOf(name) {
    return Number.parseFloat(tokenOf(name)) || 0;
}

function tokenOf(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
