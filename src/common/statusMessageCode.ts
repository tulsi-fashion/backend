export const STATUS_CODE = {
  EC500: 500,
  EC200: 200,
  EC201: 201,
  EC400: 400,
  EC401: 401,
  EC403: 403,
  EC404: 404,
  EC409: 409,
  EC422: 422,
  EC204: 204,
};

export const RES_STATUS = {
  E1: true,
  E2: false,
};

export const RES_MESSAGE = {
  EM500: 'Something went wrong, please try again later',
  EM200: 'Data Fetched Successfully!',
  EM201: 'Record Created Successfully!',
  EM208: 'Data Updated Successfully!',
  EM210: 'Data Deleted Successfully!',
  EM400: 'Bad Request',
  EM401: 'Unauthorized',
  EM403: 'Forbidden',
  EM404: 'Record Not Found!',
  EM409: 'Record Already Exists!',
  EM422: 'Unprocessable Content',
  LOGIN_SUCCESS: 'Login Successful!',
  LOGOUT_SUCCESS: 'Logged Out Successfully!',
  INVALID_CREDENTIALS: 'Invalid email or password',
  TOKEN_EXPIRED: 'Session expired, please login again',
  REGISTER_SUCCESS: 'Registration Successful!',
  INSUFFICIENT_STOCK: 'Insufficient stock for one or more items',
  INVALID_TOKEN: 'Invalid or expired token',
};
