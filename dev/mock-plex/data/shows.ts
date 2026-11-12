export interface MockShow {
    ratingKey: number;
    title: string;
    year: number;
    genres: string[];
    studio: string;
    seasons: number;
    episodesPerSeason: number;
    minutes: number;
    poster: string;
}

// Made-up shows with stand-in posters.
// Season key: show + 10 x season. Episode key: show + 100 x season + episode.
export const SHOWS: MockShow[] = [
    {
        ratingKey: 1000,
        title: 'Harbour Lights',
        year: 2019,
        genres: ['Drama'],
        studio: 'Northlight',
        seasons: 4,
        episodesPerSeason: 10,
        minutes: 50,
        poster: 'harbour.svg',
    },
    {
        ratingKey: 2000,
        title: 'The Night Desk',
        year: 2022,
        genres: ['Thriller', 'Crime'],
        studio: 'Fourth Estate TV',
        seasons: 2,
        episodesPerSeason: 8,
        minutes: 45,
        poster: 'nightdesk.svg',
    },
    {
        ratingKey: 3000,
        title: 'Ward 9',
        year: 2020,
        genres: ['Comedy'],
        studio: 'Bedside Films',
        seasons: 1,
        episodesPerSeason: 6,
        minutes: 25,
        poster: 'ward9.svg',
    },
];

export const ACCOUNTS = [
    {
        id: 1,
        name: 'Alex',
    },
    {
        id: 2,
        name: 'Sam',
    },
    {
        id: 3,
        name: 'Jo',
    },
    {
        id: 4,
        name: 'Kit',
    },
    {
        id: 5,
        name: 'Never watched',
    },
    {
        id: 6,
        name: 'Frankie',
    },
    {
        id: 7,
        name: 'Tess',
    },
];
