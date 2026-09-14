/** A scored candidate id. `rank` is 1-based within the list it came from. */
export interface Ranked {
  id: string;
  score: number;
  rank: number;
}

/** One shaped retrieval hit, field-for-field what query.py returns. */
export interface QueryResult {
  skill: string;
  score: number;
  why: string;
  description: string;
  source: string;
  domains: string[];
}

/** A skill that set-completion pulled in, with the label of the recipe that pulled it. */
export interface Completion {
  skill: string;
  recipe: string;
}
