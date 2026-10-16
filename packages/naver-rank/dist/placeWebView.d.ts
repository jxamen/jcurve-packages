import { type Job } from './webQueue';
export declare function PlaceWebView({ job, onDone }: {
    job: Job;
    onDone: () => void;
}): import("react").JSX.Element;
