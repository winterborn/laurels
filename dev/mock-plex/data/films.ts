export interface MockFilm {
    title: string;
    year: number;
    minutes: number;
    genres: string[];
    directors: string[];
    actors: string[];
    studio: string;
    country: string;
    // File in ../posters. Others get a painted poster.
    poster?: string;
}

const film = (
    title: string,
    year: number,
    minutes: number,
    genres: string[],
    directors: string[],
    actors: string[],
    studio: string,
    country = 'United States of America',
    poster?: string,
): MockFilm => ({
    title,
    year,
    minutes,
    genres,
    directors,
    actors,
    studio,
    country,
    poster,
});

const KEATON = ['Buster Keaton'];

// Public-domain and classic films. Rating keys are 101 upwards, in order.
export const FILMS: MockFilm[] = [
    film('Night of the Living Dead', 1968, 96, ['Horror'], ['George A. Romero'], ['Duane Jones', "Judith O'Dea"], 'Image Ten', undefined, 'dead.jpg'),
    film('The Cabinet of Dr. Caligari', 1920, 76, ['Horror'], ['Robert Wiene'], ['Werner Krauss', 'Conrad Veidt'], 'Decla-Bioscop', 'Germany', 'caligari.jpg'),
    film('Nosferatu', 1922, 94, ['Horror'], ['F. W. Murnau'], ['Max Schreck'], 'Prana Film', 'Germany'),
    film('Carnival of Souls', 1962, 78, ['Horror'], ['Herk Harvey'], ['Candace Hilligoss'], 'Harcourt Productions'),
    film('House on Haunted Hill', 1959, 75, ['Horror'], ['William Castle'], ['Vincent Price'], 'Allied Artists'),
    film('The Last Man on Earth', 1964, 86, ['Horror', 'Science Fiction'], ['Ubaldo Ragona'], ['Vincent Price'], 'American International', 'Italy'),
    film('The Little Shop of Horrors', 1960, 72, ['Horror', 'Comedy'], ['Roger Corman'], ['Jonathan Haze', 'Jack Nicholson'], 'Filmgroup'),
    film('Dementia 13', 1963, 75, ['Horror'], ['Francis Ford Coppola'], ['William Campbell'], 'Filmgroup'),
    film("The Brain That Wouldn't Die", 1962, 82, ['Horror', 'Science Fiction'], ['Joseph Green'], ['Jason Evers'], 'Sterling'),
    film('The Phantom of the Opera', 1925, 93, ['Horror'], ['Rupert Julian'], ['Lon Chaney'], 'Universal'),
    film('White Zombie', 1932, 69, ['Horror'], ['Victor Halperin'], ['Bela Lugosi'], 'Halperin Productions'),
    film('The Terror', 1963, 81, ['Horror'], ['Roger Corman'], ['Boris Karloff', 'Jack Nicholson'], 'Filmgroup'),
    film('A Bucket of Blood', 1959, 66, ['Horror', 'Comedy'], ['Roger Corman'], ['Dick Miller'], 'American International'),
    film('Häxan', 1922, 105, ['Horror', 'Documentary'], ['Benjamin Christensen'], ['Benjamin Christensen'], 'Svensk Filmindustri', 'Sweden'),
    film('The Golem', 1920, 91, ['Horror'], ['Paul Wegener'], ['Paul Wegener'], 'UFA', 'Germany'),
    film('Vampyr', 1932, 73, ['Horror'], ['Carl Theodor Dreyer'], ['Julian West'], 'Tobis', 'Germany'),
    film('The Man Who Laughs', 1928, 110, ['Horror', 'Drama'], ['Paul Leni'], ['Conrad Veidt'], 'Universal'),
    film('The Cat and the Canary', 1927, 82, ['Horror', 'Comedy'], ['Paul Leni'], ['Laura La Plante'], 'Universal'),
    film('Dr. Jekyll and Mr. Hyde', 1920, 79, ['Horror'], ['John S. Robertson'], ['John Barrymore'], 'Paramount'),
    film('The Hunchback of Notre Dame', 1923, 102, ['Horror', 'Drama'], ['Wallace Worsley'], ['Lon Chaney'], 'Universal'),
    film('Attack of the Giant Leeches', 1959, 62, ['Horror', 'Science Fiction'], ['Bernard L. Kowalski'], ['Ken Clark'], 'American International'),
    film('The Killer Shrews', 1959, 69, ['Horror', 'Science Fiction'], ['Ray Kellogg'], ['James Best'], 'McLendon'),
    film('Horror Express', 1972, 90, ['Horror'], ['Eugenio Martín'], ['Christopher Lee', 'Peter Cushing'], 'Granada', 'Spain'),
    film('The Bat', 1959, 80, ['Horror', 'Mystery'], ['Crane Wilbur'], ['Vincent Price'], 'Allied Artists'),
    film('Bluebeard', 1944, 72, ['Horror', 'Thriller'], ['Edgar G. Ulmer'], ['John Carradine'], 'PRC'),
    film('Indestructible Man', 1956, 70, ['Horror', 'Science Fiction'], ['Jack Pollexfen'], ['Lon Chaney Jr.'], 'Allied Artists'),
    film('The Screaming Skull', 1958, 68, ['Horror'], ['Alex Nicol'], ['John Hudson'], 'American International'),
    film('Sherlock Jr.', 1924, 45, ['Comedy'], KEATON, [...KEATON, 'Kathryn McGuire'], 'Metro Pictures', undefined, 'sherlock.jpg'),
    film('The General', 1926, 78, ['Comedy', 'Action'], [...KEATON, 'Clyde Bruckman'], [...KEATON, 'Marion Mack'], 'United Artists', undefined, 'general.png'),
    film('Our Hospitality', 1923, 74, ['Comedy'], [...KEATON, 'John G. Blystone'], KEATON, 'Metro Pictures'),
    film('Seven Chances', 1925, 56, ['Comedy'], KEATON, KEATON, 'Metro-Goldwyn'),
    film('The Navigator', 1924, 59, ['Comedy'], [...KEATON, 'Donald Crisp'], KEATON, 'Metro-Goldwyn'),
    film('Three Ages', 1923, 63, ['Comedy'], [...KEATON, 'Edward F. Cline'], KEATON, 'Metro Pictures'),
    film('Steamboat Bill, Jr.', 1928, 70, ['Comedy'], ['Charles Reisner'], KEATON, 'United Artists'),
    film('College', 1927, 66, ['Comedy'], ['James W. Horne'], KEATON, 'United Artists'),
    film('The Cameraman', 1928, 76, ['Comedy'], ['Edward Sedgwick'], KEATON, 'MGM'),
    film('Go West', 1925, 69, ['Comedy'], KEATON, KEATON, 'Metro-Goldwyn'),
    film('Battling Butler', 1926, 77, ['Comedy'], KEATON, KEATON, 'MGM'),
    film('The Kid', 1921, 68, ['Comedy', 'Drama'], ['Charlie Chaplin'], ['Charlie Chaplin', 'Jackie Coogan'], 'First National'),
    film('The Gold Rush', 1925, 95, ['Comedy'], ['Charlie Chaplin'], ['Charlie Chaplin'], 'United Artists'),
    film('Safety Last!', 1923, 74, ['Comedy'], ['Fred C. Newmeyer'], ['Harold Lloyd'], 'Pathé'),
    film('His Girl Friday', 1940, 92, ['Comedy', 'Romance'], ['Howard Hawks'], ['Cary Grant', 'Rosalind Russell'], 'Columbia'),
    film('My Man Godfrey', 1936, 94, ['Comedy', 'Romance'], ['Gregory La Cava'], ['William Powell', 'Carole Lombard'], 'Universal'),
    film('Charade', 1963, 113, ['Thriller', 'Romance', 'Comedy'], ['Stanley Donen'], ['Cary Grant', 'Audrey Hepburn'], 'Universal', undefined, 'charade.jpg'),
    film('Metropolis', 1927, 153, ['Science Fiction', 'Drama'], ['Fritz Lang'], ['Brigitte Helm'], 'UFA', 'Germany', 'metropolis.jpg'),
    film('A Trip to the Moon', 1902, 14, ['Science Fiction', 'Fantasy'], ['Georges Méliès'], ['Georges Méliès'], 'Star Film', 'France', 'moon.jpg'),
    film('Plan 9 from Outer Space', 1957, 79, ['Science Fiction'], ['Ed Wood'], ['Bela Lugosi'], 'Reynolds Pictures'),
    film('The Lost World', 1925, 106, ['Science Fiction', 'Adventure'], ['Harry O. Hoyt'], ['Wallace Beery'], 'First National'),
    film('Detour', 1945, 68, ['Thriller', 'Crime'], ['Edgar G. Ulmer'], ['Tom Neal'], 'PRC'),
    film('D.O.A.', 1950, 83, ['Thriller', 'Crime'], ['Rudolph Maté'], ["Edmond O'Brien"], 'United Artists'),
    film('The Stranger', 1946, 95, ['Thriller'], ['Orson Welles'], ['Orson Welles', 'Loretta Young'], 'RKO'),
    film('Scarlet Street', 1945, 102, ['Thriller', 'Crime'], ['Fritz Lang'], ['Edward G. Robinson'], 'Universal'),
    film('The Hitch-Hiker', 1953, 71, ['Thriller'], ['Ida Lupino'], ["Edmond O'Brien"], 'RKO'),
    film('Napoléon', 1927, 330, ['Drama', 'History'], ['Abel Gance'], ['Albert Dieudonné'], 'Ciné France', 'France'),
    film('Intolerance', 1916, 163, ['Drama', 'History'], ['D. W. Griffith'], ['Lillian Gish'], 'Triangle'),
    film('Nanook of the North', 1922, 79, ['Documentary'], ['Robert J. Flaherty'], ['Allakariallak'], 'Revillon Frères'),
    film('The Great Train Robbery', 1903, 12, ['Western'], ['Edwin S. Porter'], ['Justus D. Barnes'], 'Edison'),
    film('Battleship Potemkin', 1925, 75, ['Drama', 'History'], ['Sergei Eisenstein'], ['Aleksandr Antonov'], 'Goskino', 'Soviet Union'),
    film('Sunrise', 1927, 94, ['Drama', 'Romance'], ['F. W. Murnau'], ["George O'Brien", 'Janet Gaynor'], 'Fox'),
    film("It's a Wonderful Life", 1946, 130, ['Drama', 'Fantasy'], ['Frank Capra'], ['James Stewart', 'Donna Reed'], 'RKO'),
];
