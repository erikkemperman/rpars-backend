import * as axios from 'axios';

export class HttpClient {

  static async get(url: string): Promise<axios.AxiosResponse> {
    const response = await axios.default.get(url);
    return response;
  }

  static async post(url: string, data: object | string, options?: {}): Promise<axios.AxiosResponse> {
    const response = await axios.default.post(url, data, options);
    console.log(response);
    return response;
  }

};
