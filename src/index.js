/* eslint-disable no-console */
import requestStream from './request-stream.js';
import MuxWorker from 'worker!./mux-worker.worker.js';
import window from 'global/window';
import document from 'global/document';

class XhrStreamer {
  constructor() {
    this.eventBus_ = document.createElement('div');
    this.worker_ = null;
    this.handleMessage = this.handleMessage.bind(this);
  }

  addEventListener() {
    return this.eventBus_.addEventListener.apply(this.eventBus_, arguments);
  }

  removeEventListener() {
    return this.eventBus_.removeEventListener.apply(this.eventBus_, arguments);
  }

  trigger(eventName, detail) {
    return this.eventBus_.dispatchEvent(new window.CustomEvent(eventName, {detail}));
  }

  createWorker_() {
    if (this.worker_) {
      return;
    }

    this.worker_ = new MuxWorker();
    this.worker_.addEventListener('message', this.handleMessage);
  }

  streamRequest(uri) {
    this.createWorker_();

    const dataFn = (data) => {
      this.worker_.postMessage({type: 'push', data: data.buffer}, [data.buffer]);
    };
    const doneFn = () => {
      this.abort_ = null;
    };

    this.abort_ = requestStream(uri, dataFn, doneFn);
  }

  abort() {
    if (this.abort_) {
      this.abort_();
    }

    if (this.worker_) {
      this.worker_.postMessage({type: 'abort'});
    }
  }

  handleMessage(e) {
    const message = e.data;

    switch (message.type) {
    case 'canPlay':
      this.worker_.postMessage({
        type: 'canPlayResponse',
        types: message.types.map(({type, mimetype}) => {
          return {
            mimetype,
            type,
            canPlay: window.MediaSource.isTypeSupported(mimetype)
          };
        })
      });
      break;
    case 'data':
      this.trigger('data', {data: message.data, mimetypes: message.mimetypes});
      if (!this.abort_) {
        this.trigger('done');
      }
      break;
    }

  }

  dispose() {
    this.worker_.removeEventListener('message', this.handleMessage);
    this.worker_.terminate();
  }

}

export default XhrStreamer;
